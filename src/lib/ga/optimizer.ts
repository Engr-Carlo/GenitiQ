/**
 * Genetic Algorithm Queue Optimizer
 *
 * Optimizes inspection queue ordering across machines to minimize
 * total wait time, balance machine utilization, and respect priority.
 *
 * Chromosome: Array of queue assignments (part → machine, position)
 * Fitness: Weighted sum of wait-time, utilization balance, priority respect
 */

import { GAConfig, QueueChromosome, QueueGene, FitnessResult } from "./types";

// ============================================================
// Default configuration
// ============================================================

export const DEFAULT_GA_CONFIG: GAConfig = {
  populationSize: 50,
  generations: 100,
  crossoverRate: 0.8,
  mutationRate: 0.15,
  elitismCount: 2,
  tournamentSize: 3,
  weights: {
    waitTime: 0.4,
    utilization: 0.3,
    priority: 0.3,
  },
};

// ============================================================
// Core GA Class
// ============================================================

export class GeneticQueueOptimizer {
  private config: GAConfig;
  private machines: { id: string; cycleTime: number; status: string }[];
  private parts: { id: string; priority: number; estimatedTime: number }[];

  constructor(
    config: Partial<GAConfig>,
    machines: { id: string; cycleTime: number; status: string }[],
    parts: { id: string; priority: number; estimatedTime: number }[]
  ) {
    this.config = { ...DEFAULT_GA_CONFIG, ...config };
    this.machines = machines.filter((m) => m.status === "ACTIVE");
    this.parts = parts;
  }

  // -- Public entry point --
  optimize(): { bestChromosome: QueueChromosome; fitness: FitnessResult; generations: number } {
    if (this.parts.length === 0 || this.machines.length === 0) {
      return {
        bestChromosome: { genes: [], fitness: 0 },
        fitness: { total: 0, waitTimeScore: 0, utilizationScore: 0, priorityScore: 0 },
        generations: 0,
      };
    }

    let population = this.initializePopulation();
    let bestEver = this.getBest(population);

    for (let gen = 0; gen < this.config.generations; gen++) {
      const evaluated = population.map((c) => ({
        chromosome: c,
        fitness: this.evaluateFitness(c),
      }));

      evaluated.sort((a, b) => b.fitness.total - a.fitness.total);

      // Elitism
      const nextGen: QueueChromosome[] = evaluated
        .slice(0, this.config.elitismCount)
        .map((e) => ({ ...e.chromosome, fitness: e.fitness.total }));

      // Fill rest of population via selection, crossover, mutation
      while (nextGen.length < this.config.populationSize) {
        const parent1 = this.tournamentSelect(evaluated);
        const parent2 = this.tournamentSelect(evaluated);

        let [child1, child2] = this.crossover(parent1.chromosome, parent2.chromosome);
        child1 = this.mutate(child1);
        child2 = this.mutate(child2);

        nextGen.push(child1);
        if (nextGen.length < this.config.populationSize) {
          nextGen.push(child2);
        }
      }

      population = nextGen;

      const currentBest = this.getBest(population);
      if (currentBest.fitness > bestEver.fitness) {
        bestEver = currentBest;
      }
    }

    return {
      bestChromosome: bestEver,
      fitness: this.evaluateFitness(bestEver),
      generations: this.config.generations,
    };
  }

  // -- Population initialization --
  private initializePopulation(): QueueChromosome[] {
    const pop: QueueChromosome[] = [];
    for (let i = 0; i < this.config.populationSize; i++) {
      pop.push(this.randomChromosome());
    }
    return pop;
  }

  private randomChromosome(): QueueChromosome {
    const genes: QueueGene[] = [];
    const shuffled = [...this.parts].sort(() => Math.random() - 0.5);
    const machineQueues: Record<string, number> = {};

    this.machines.forEach((m) => (machineQueues[m.id] = 0));

    shuffled.forEach((part) => {
      // Assign to machine with shortest queue (greedy heuristic + randomness)
      const machineId = this.selectMachineForPart(machineQueues);
      machineQueues[machineId]++;
      genes.push({
        partId: part.id,
        machineId,
        position: machineQueues[machineId],
      });
    });

    return { genes, fitness: 0 };
  }

  private selectMachineForPart(queues: Record<string, number>): string {
    const entries = Object.entries(queues);
    // 70% greedy (shortest queue), 30% random for diversity
    if (Math.random() < 0.7) {
      entries.sort((a, b) => a[1] - b[1]);
      return entries[0][0];
    }
    return entries[Math.floor(Math.random() * entries.length)][0];
  }

  // -- Fitness evaluation --
  evaluateFitness(chromosome: QueueChromosome): FitnessResult {
    const { weights } = this.config;

    const waitTimeScore = this.calcWaitTimeScore(chromosome);
    const utilizationScore = this.calcUtilizationScore(chromosome);
    const priorityScore = this.calcPriorityScore(chromosome);

    const total =
      weights.waitTime * waitTimeScore +
      weights.utilization * utilizationScore +
      weights.priority * priorityScore;

    return { total, waitTimeScore, utilizationScore, priorityScore };
  }

  private calcWaitTimeScore(chromosome: QueueChromosome): number {
    // Lower total wait time is better → score = 1 / (1 + normalized wait)
    let totalWait = 0;
    const machineTime: Record<string, number> = {};
    this.machines.forEach((m) => (machineTime[m.id] = 0));

    // Compute wait time per part given the ordering
    const sorted = [...chromosome.genes].sort((a, b) => a.position - b.position);
    sorted.forEach((gene) => {
      const part = this.parts.find((p) => p.id === gene.partId);
      if (!part) return;
      const machine = this.machines.find((m) => m.id === gene.machineId);
      if (!machine) return;

      const startTime = machineTime[gene.machineId] || 0;
      totalWait += startTime;
      machineTime[gene.machineId] = startTime + part.estimatedTime;
    });

    const maxPossibleWait = this.parts.length * this.parts.reduce((max, p) => Math.max(max, p.estimatedTime), 0) * this.parts.length;
    return maxPossibleWait > 0 ? 1 - totalWait / maxPossibleWait : 1;
  }

  private calcUtilizationScore(chromosome: QueueChromosome): number {
    // Equal distribution of parts across machines → low variance is better
    const machineCounts: Record<string, number> = {};
    this.machines.forEach((m) => (machineCounts[m.id] = 0));
    chromosome.genes.forEach((g) => {
      machineCounts[g.machineId] = (machineCounts[g.machineId] || 0) + 1;
    });

    const counts = Object.values(machineCounts);
    const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
    const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
    const maxVariance = (this.parts.length ** 2) / 4;
    return maxVariance > 0 ? 1 - variance / maxVariance : 1;
  }

  private calcPriorityScore(chromosome: QueueChromosome): number {
    // Higher priority parts should be earlier in the queue
    let score = 0;
    let total = 0;

    chromosome.genes.forEach((gene) => {
      const part = this.parts.find((p) => p.id === gene.partId);
      if (!part) return;
      // Priority 3=HIGH, 2=MEDIUM, 1=LOW; position 1 = first
      const positionPenalty = gene.position;
      score += part.priority / positionPenalty; // High priority + low position = high score
      total += part.priority;
    });

    return total > 0 ? score / total : 1;
  }

  // -- Selection --
  private tournamentSelect(
    evaluated: { chromosome: QueueChromosome; fitness: FitnessResult }[]
  ): { chromosome: QueueChromosome; fitness: FitnessResult } {
    let best = evaluated[Math.floor(Math.random() * evaluated.length)];
    for (let i = 1; i < this.config.tournamentSize; i++) {
      const contender = evaluated[Math.floor(Math.random() * evaluated.length)];
      if (contender.fitness.total > best.fitness.total) {
        best = contender;
      }
    }
    return best;
  }

  // -- Crossover (Order Crossover — OX) --
  private crossover(p1: QueueChromosome, p2: QueueChromosome): [QueueChromosome, QueueChromosome] {
    if (Math.random() > this.config.crossoverRate) {
      return [{ ...p1 }, { ...p2 }];
    }

    const len = p1.genes.length;
    if (len < 2) return [{ ...p1 }, { ...p2 }];

    const start = Math.floor(Math.random() * len);
    const end = start + Math.floor(Math.random() * (len - start));

    const child1Genes = this.orderCrossover(p1.genes, p2.genes, start, end);
    const child2Genes = this.orderCrossover(p2.genes, p1.genes, start, end);

    return [
      { genes: child1Genes, fitness: 0 },
      { genes: child2Genes, fitness: 0 },
    ];
  }

  private orderCrossover(parent1: QueueGene[], parent2: QueueGene[], start: number, end: number): QueueGene[] {
    const child: (QueueGene | null)[] = new Array(parent1.length).fill(null);
    const usedParts = new Set<string>();

    // Copy segment from parent1
    for (let i = start; i <= end; i++) {
      child[i] = { ...parent1[i] };
      usedParts.add(parent1[i].partId);
    }

    // Fill remaining from parent2 in order
    let fillIdx = (end + 1) % parent1.length;
    for (const gene of parent2) {
      if (!usedParts.has(gene.partId)) {
        child[fillIdx] = { ...gene };
        usedParts.add(gene.partId);
        fillIdx = (fillIdx + 1) % parent1.length;
      }
    }

    // Recalculate positions per machine
    const machinePos: Record<string, number> = {};
    return child.map((g) => {
      const gene = g!;
      machinePos[gene.machineId] = (machinePos[gene.machineId] || 0) + 1;
      return { ...gene, position: machinePos[gene.machineId] };
    });
  }

  // -- Mutation (swap two genes' machine assignments) --
  private mutate(chromosome: QueueChromosome): QueueChromosome {
    if (Math.random() > this.config.mutationRate) return chromosome;

    const genes = [...chromosome.genes.map((g) => ({ ...g }))];
    const len = genes.length;
    if (len < 2) return chromosome;

    const mutationType = Math.random();

    if (mutationType < 0.5) {
      // Swap mutation: swap two parts' positions
      const i = Math.floor(Math.random() * len);
      const j = Math.floor(Math.random() * len);
      [genes[i], genes[j]] = [genes[j], genes[i]];
    } else {
      // Reassignment mutation: move a part to a different machine
      const idx = Math.floor(Math.random() * len);
      const currentMachine = genes[idx].machineId;
      const otherMachines = this.machines.filter((m) => m.id !== currentMachine);
      if (otherMachines.length > 0) {
        genes[idx].machineId = otherMachines[Math.floor(Math.random() * otherMachines.length)].id;
      }
    }

    // Recalculate positions
    const machinePos: Record<string, number> = {};
    genes.forEach((g) => {
      machinePos[g.machineId] = (machinePos[g.machineId] || 0) + 1;
      g.position = machinePos[g.machineId];
    });

    return { genes, fitness: 0 };
  }

  // -- Helpers --
  private getBest(population: QueueChromosome[]): QueueChromosome {
    let best = population[0];
    let bestFitness = this.evaluateFitness(best).total;

    for (const c of population) {
      const f = this.evaluateFitness(c).total;
      if (f > bestFitness) {
        best = c;
        bestFitness = f;
      }
    }

    return { ...best, fitness: bestFitness };
  }
}
