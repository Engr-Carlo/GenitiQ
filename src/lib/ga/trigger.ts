/**
 * GA Trigger — orchestrates the optimization flow.
 * Uses PartReference (unscanned) as the source of parts to optimize.
 */

import { GeneticQueueOptimizer, DEFAULT_GA_CONFIG } from "./optimizer";
import { GAConfig, OptimizationResult } from "./types";
import { prisma } from "@/lib/db";

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

  // 2. Fetch unscanned PartReferences for this machine type
  const pendingRefs = await prisma.partReference.findMany({
    where: {
      machine: { type: machineType },
      isScanned: false,
    },
    select: {
      id: true,
      machineId: true,
      estimatedTime: true,
      deadline: true,
      quantity: true,
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

  // 3b. Historical average times per machine from Inspection records
  const machineTimings = await prisma.inspection.groupBy({
    by: ["machineId"],
    _avg: { operatorActualTime: true },
    where: { operatorActualTime: { not: null } },
  });
  const timingMap = new Map(machineTimings.map((t) => [t.machineId, t._avg.operatorActualTime || 15]));

  // 4. Build priority scores using GA algorithm (deadline urgency + complexity)
  const refPriority = (ref: typeof pendingRefs[number]): number => {
    const hoursToDeadline = (ref.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
    const urgencyScore = Math.max(0, 100 - hoursToDeadline / 2);
    const complexityScore = (ref.estimatedTime / 60) * 50 + (ref.quantity / 10) * 50;
    const fitness = urgencyScore * 0.6 + complexityScore * 0.4;
    if (fitness > 70 || hoursToDeadline < 24) return 3; // HIGH
    if (fitness > 40 || hoursToDeadline < 72) return 2; // MEDIUM
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

  await Promise.all(
    assignments.map((a) =>
      prisma.partReference.update({
        where: { id: a.partId },
        data: { machineId: a.machineId, position: a.position },
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
    where: { machine: { type: machineType }, isScanned: false },
  });
  return pendingCount >= 2;
}
