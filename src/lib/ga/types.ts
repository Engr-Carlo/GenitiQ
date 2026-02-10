/**
 * GA Type Definitions
 */

export interface GAConfig {
  populationSize: number;
  generations: number;
  crossoverRate: number;
  mutationRate: number;
  elitismCount: number;
  tournamentSize: number;
  weights: {
    waitTime: number;
    utilization: number;
    priority: number;
  };
}

export interface QueueGene {
  partId: string;
  machineId: string;
  position: number;
}

export interface QueueChromosome {
  genes: QueueGene[];
  fitness: number;
}

export interface FitnessResult {
  total: number;
  waitTimeScore: number;
  utilizationScore: number;
  priorityScore: number;
}

export interface OptimizationResult {
  assignments: {
    partId: string;
    machineId: string;
    position: number;
    estimatedWaitTime: number;
  }[];
  fitness: FitnessResult;
  generations: number;
  executionTimeMs: number;
}
