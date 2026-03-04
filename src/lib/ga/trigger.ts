/**
 * GA Trigger — orchestrates the optimization flow.
 * Uses PartReference (unscanned) as the source of parts to optimize.
 *
 * Priority formula (4 parameters):
 *   urgency      × 0.40  — deadline proximity (most critical)
 *   machineScore × 0.25  — production machine speed (Micron=fast=high priority)
 *   quantity     × 0.20  — order size
 *   timeScore    × 0.15  — estimated inspection time
 */

import { GeneticQueueOptimizer, DEFAULT_GA_CONFIG } from "./optimizer";
import { GAConfig, OptimizationResult } from "./types";
import { prisma } from "@/lib/db";

/**
 * Production machine speed factors.
 * Faster machines produce higher volume → their parts need QA faster → higher priority.
 * Unknown/unset brands fall back to 0.50 (MEDIUM weight).
 */
const PRODUCTION_MACHINE_SPEED: Record<string, number> = {
  Micron: 1.0,
  Brother: 0.66,
  Okuma: 0.33,
};

/**
 * Runs the GA optimizer for a specific machine type (VMM or CMM).
 * 1. Fetches active machines + pending (unscanned) PartReferences from DB
 * 2. Loads GA configuration or uses defaults
 * 3. Runs optimizer
 * 4. Persists new position ordering back to PartReference
 */
export async function runGAOptimization(
  machineType: "VMM" | "CMM",
  configOverride?: Partial<GAConfig>
): Promise<OptimizationResult> {
  const startTime = Date.now();

  // 1. Fetch available machines for this type
  const machines = await prisma.machine.findMany({
    where: { type: machineType, status: { in: ["ACTIVE", "IDLE"] } },
    select: { id: true, name: true, status: true, currentSessionId: true },
  });

  // 2. Fetch unscanned PartReferences for this machine type.
  //    Match parts that EITHER already have a machineId pointing to a machine of this
  //    type OR are freshly uploaded (machineId = null) but have the machineType scalar set.
  const pendingRefs = await prisma.partReference.findMany({
    where: {
      status: "PENDING",
      OR: [
        { machine: { type: machineType } },
        { machineId: null, machineType: machineType },
      ],
    },
    select: {
      id: true,
      machineId: true,
      estimatedTime: true,
      deadline: true,
      quantity: true,
      productionMachine: true,
      machine: true,
    },
  });

  // 3. Load GA config from DB (or defaults)
  const dbConfig = await prisma.gAConfiguration.findFirst({ where: { isActive: true } });

  const gaConfig: Partial<GAConfig> = configOverride || {
    populationSize: dbConfig?.populationSize ?? DEFAULT_GA_CONFIG.populationSize,
    generations: dbConfig?.generations ?? DEFAULT_GA_CONFIG.generations,
    crossoverRate: dbConfig?.crossoverRate ?? DEFAULT_GA_CONFIG.crossoverRate,
    mutationRate: dbConfig?.mutationRate ?? DEFAULT_GA_CONFIG.mutationRate,
    elitismCount: dbConfig?.elitismCount ?? DEFAULT_GA_CONFIG.elitismCount,
    weights: {
      waitTime: dbConfig?.waitTimeWeight ?? DEFAULT_GA_CONFIG.weights.waitTime,
      utilization: dbConfig?.utilizationWeight ?? DEFAULT_GA_CONFIG.weights.utilization,
      priority: dbConfig?.priorityWeight ?? DEFAULT_GA_CONFIG.weights.priority,
      sessionAvailability: DEFAULT_GA_CONFIG.weights.sessionAvailability,
    },
  };

  // 3b. Historical average times per machine from PartReference records
  const machineTimings = await prisma.partReference.groupBy({
    by: ["machineId"],
    _avg: { operatorActualTime: true },
    where: { operatorActualTime: { not: null } },
  });
  const timingMap = new Map(machineTimings.map((t) => [t.machineId, t._avg.operatorActualTime || 15]));

  // 4. Build priority scores from all 4 parameters:
  //    deadline urgency (0.40) + production machine speed (0.25)
  //    + quantity of order (0.20) + estimated inspection time (0.15)
  const refPriority = (ref: typeof pendingRefs[number]): number => {
    const hoursToDeadline = (ref.deadline.getTime() - Date.now()) / (1000 * 60 * 60);

    // 1. Deadline urgency — closer deadline = higher score (0–100)
    const urgencyScore = Math.max(0, Math.min(100, 100 - hoursToDeadline / 2));

    // 2. Production machine speed — faster machine = higher throughput = more parts = more urgency
    const speedFactor = PRODUCTION_MACHINE_SPEED[ref.productionMachine ?? ""] ?? 0.5;
    const machineScore = speedFactor * 100; // 0–100

    // 3. Quantity of order — larger batch = higher urgency (capped at qty 50 = 100 score)
    const quantityScore = Math.min(100, (ref.quantity / 50) * 100);

    // 4. Estimated inspection time — longer inspection = start earlier = higher urgency
    const timeScore = Math.min(100, ((ref.estimatedTime ?? 15) / 120) * 100);

    const fitness =
      urgencyScore  * 0.40 +
      machineScore  * 0.25 +
      quantityScore * 0.20 +
      timeScore     * 0.15;

    if (fitness > 70 || hoursToDeadline < 24) return 3; // HIGH
    if (fitness > 45 || hoursToDeadline < 72) return 2; // MEDIUM
    return 1; // LOW
  };

  // 5. Run optimizer
  const optimizer = new GeneticQueueOptimizer(
    gaConfig,
    machines.map((m) => ({
      id: m.id,
      cycleTime: timingMap.get(m.id) || 15,
      status: m.status,
      hasActiveSession: !!m.currentSessionId,
      avgHistoricalTime: timingMap.get(m.id),
    })),
    pendingRefs.map((ref) => ({
      id: ref.id,
      priority: refPriority(ref),
      estimatedTime: ref.estimatedTime || 15,
    }))
  );

  const result = optimizer.optimize();
  const executionTimeMs = Date.now() - startTime;

  // 6. Persist new position ordering back to PartReference
  const assignments = result.bestChromosome.genes.map((gene) => ({
    partId: gene.partId,
    machineId: gene.machineId,
    position: gene.position,
    estimatedWaitTime: gene.position * 15,
  }));

  // Build a lookup for the numeric priority we calculated per part
  const priorityMap = new Map<string, number>(
    pendingRefs.map((ref) => [ref.id, refPriority(ref)])
  );

  const priorityLabel = (score: number): string =>
    score >= 3 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";

  await Promise.all(
    assignments.map((a) =>
      prisma.partReference.update({
        where: { id: a.partId },
        data: {
          machineId: a.machineId,
          position: a.position,
          // Write back the computed priority label so the queue UI reflects it immediately
          priority: priorityLabel(priorityMap.get(a.partId) ?? 1),
        },
      })
    )
  );

  return { assignments, fitness: result.fitness, generations: result.generations, executionTimeMs };
}

/**
 * Check if re-optimization is needed (at least 2 unscanned parts for a machine type).
 */
export async function shouldReoptimize(machineType: "VMM" | "CMM"): Promise<boolean> {
  const pendingCount = await prisma.partReference.count({
    where: { machine: { type: machineType }, status: "PENDING" },
  });
  return pendingCount >= 2;
}
