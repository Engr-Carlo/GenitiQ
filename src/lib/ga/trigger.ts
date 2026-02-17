/**
 * GA Trigger — orchestrates the optimization flow.
 * Called by API routes when a re-optimization is requested.
 */

import { GeneticQueueOptimizer, DEFAULT_GA_CONFIG } from "./optimizer";
import { GAConfig, OptimizationResult } from "./types";
import { prisma } from "@/lib/db";

// Priority mapping
const PRIORITY_MAP: Record<string, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Runs the GA optimizer for a specific machine type (VMM or CMM).
 * 1. Fetches active machines + pending parts from DB
 * 2. Loads GA configuration or uses defaults
 * 3. Runs optimizer
 * 4. Persists new queue ordering back to DB
 */
export async function runGAOptimization(
  machineType: "VMM" | "CMM",
  configOverride?: Partial<GAConfig>
): Promise<OptimizationResult> {
  const startTime = Date.now();

  // 1. Fetch available machines (ACTIVE or IDLE) for this type, with session info
  const machines = await prisma.machine.findMany({
    where: { type: machineType, status: { in: ["ACTIVE", "IDLE"] } },
    select: {
      id: true,
      name: true,
      status: true,
      currentSessionId: true,
    },
  });

  // 2. Fetch pending queue items
  const queueItems = await prisma.inspectionQueue.findMany({
    where: {
      machine: { type: machineType },
      status: "WAITING",
    },
    include: { part: true, machine: true },
  });

  // 3. Load GA config from DB (or defaults)
  const dbConfig = await prisma.gAConfiguration.findFirst({
    where: { isActive: true },
  });

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

  // 3b. Fetch historical average times per machine for better estimates
  const machineTimings = await prisma.inspectionQueue.groupBy({
    by: ["machineId"],
    _avg: { queueActualTime: true },
    where: { queueActualTime: { not: null } },
  });
  const timingMap = new Map(machineTimings.map((t) => [t.machineId, t._avg.queueActualTime || 15]));

  // 4. Run optimizer
  const optimizer = new GeneticQueueOptimizer(
    gaConfig,
    machines.map((m) => ({
      id: m.id,
      cycleTime: timingMap.get(m.id) || 15,
      status: m.status,
      hasActiveSession: !!m.currentSessionId,
      avgHistoricalTime: timingMap.get(m.id),
    })),
    queueItems.map((qi) => ({
      id: qi.id,
      priority: PRIORITY_MAP[qi.priority] || 1,
      estimatedTime: qi.estimatedTime || 15,
    }))
  );

  const result = optimizer.optimize();
  const executionTimeMs = Date.now() - startTime;

  // 5. Persist new queue ordering to DB
  const assignments = result.bestChromosome.genes.map((gene) => {
    const _qi = queueItems.find((q) => q.id === gene.partId);
    return {
      partId: gene.partId,
      machineId: gene.machineId,
      position: gene.position,
      estimatedWaitTime: gene.position * 15, // rough estimate
    };
  });

  // Batch-update the queue positions
  await Promise.all(
    assignments.map((a) =>
      prisma.inspectionQueue.update({
        where: { id: a.partId },
        data: {
          machineId: a.machineId,
          position: a.position,
        },
      })
    )
  );

  return {
    assignments,
    fitness: result.fitness,
    generations: result.generations,
    executionTimeMs,
  };
}

/**
 * Quick helper to check if re-optimization is needed.
 * Triggers automatically when new parts are added or machine status changes.
 */
export async function shouldReoptimize(machineType: "VMM" | "CMM"): Promise<boolean> {
  const pendingCount = await prisma.inspectionQueue.count({
    where: {
      machine: { type: machineType },
      status: "WAITING",
    },
  });

  // Only run if there are at least 2 items to optimize
  return pendingCount >= 2;
}
