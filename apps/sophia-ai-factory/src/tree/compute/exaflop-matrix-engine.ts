/**
 * @file exaflop-matrix-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for ExaFLOP Compute Matrix scheduling and Eight-Nines (99.999999%) SLA evaluation.
 */

import {
  ExaflopComputeCluster,
  PlanetaryDispatchPlan,
} from '@/seed/types/exaflop-matrix';

export { evaluateEightNinesSla } from './exaflop-sla-evaluator';

/**
 * Calculates multi-dimensional fitness score for an ExaFLOP cluster
 */
export function calculateClusterFitnessScore(cluster: ExaflopComputeCluster): number {
  if (cluster.clusterStatus !== 'OPTIMAL') {
    return 0.0;
  }

  // 1. PUE Efficiency: 1.0 is ideal, > 1.5 is penalized
  const pueEfficiency = Math.max(0, 1.5 - cluster.pueScore); // e.g. 1.5 - 1.08 = 0.42

  // 2. Backplane capacity (normalized against 1000 Tbps)
  const backplaneScore = Math.min(1.0, cluster.networkBackplaneTbps / 1000);

  // 3. Thermal efficiency (normalized 0 to 1)
  const thermalScore = Math.min(1.0, cluster.thermalEfficiencyPercentage / 100);

  // 4. Compute power (normalized against 2.0 ExaFLOPs)
  const computeScore = Math.min(1.0, cluster.totalFlopsExa / 2.0);

  // Weighted composite fitness
  const fitness =
    0.35 * pueEfficiency +
    0.25 * backplaneScore +
    0.25 * thermalScore +
    0.15 * computeScore;

  return Number(fitness.toFixed(4));
}

/**
 * Plans distribution of up to 250,000 workloads across available ExaFLOP clusters
 */
export function planPlanetaryWorkloadDispatch(
  totalWorkloads: number,
  clusters: ExaflopComputeCluster[]
): PlanetaryDispatchPlan {
  if (totalWorkloads <= 0) {
    throw new Error('Total workloads must be strictly greater than 0');
  }

  const scoredClusters = clusters
    .map((cluster) => ({
      cluster,
      fitness: calculateClusterFitnessScore(cluster),
    }))
    .filter((entry) => entry.fitness > 0)
    .sort((a, b) => b.fitness - a.fitness);

  if (scoredClusters.length === 0) {
    throw new Error('No healthy ExaFLOP clusters available for planetary dispatch');
  }

  const totalFitness = scoredClusters.reduce((sum, entry) => sum + entry.fitness, 0);

  let remaining = totalWorkloads;
  const allocations: PlanetaryDispatchPlan['clusterAllocations'] = [];

  for (let i = 0; i < scoredClusters.length; i++) {
    const entry = scoredClusters[i];
    const isLast = i === scoredClusters.length - 1;
    const share = isLast ? remaining : Math.min(remaining, Math.round((entry.fitness / totalFitness) * totalWorkloads));

    const allocatedFlopsExa = Number(((share / totalWorkloads) * entry.cluster.totalFlopsExa).toFixed(3));
    const estimatedDurationMs = Math.max(10, Math.round((share / entry.cluster.activeGpusCount) * 85));

    allocations.push({
      clusterRef: entry.cluster.clusterRef,
      allocatedWorkloads: share,
      estimatedDurationMs,
      allocatedFlopsExa,
    });

    remaining -= share;
  }

  // Sub-millisecond dispatch latency estimation
  const projectedDispatchLatencyMs = Number((0.25 + scoredClusters.length * 0.05).toFixed(2));

  return {
    planId: `DISPATCH_PLAN_${Date.now()}`,
    totalWorkloads,
    clusterAllocations: allocations,
    projectedDispatchLatencyMs,
    coolingCapacityMarginPct: 18.5,
  };
}
