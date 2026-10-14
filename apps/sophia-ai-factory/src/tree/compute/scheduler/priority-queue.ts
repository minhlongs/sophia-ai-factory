/**
 * @module tree/compute/scheduler/priority-queue
 * Multi-dimensional fitness scoring and priority evaluation for compute meshes.
 */

import type {
  ComputeMeshMetrics,
  MeshThresholds,
  FitnessWeights,
  DispatchPlanConfig,
} from './types';

/**
 * Calculates multi-dimensional scheduling fitness score for a compute mesh.
 */
export function calculateParameterizedMeshFitness(
  metrics: ComputeMeshMetrics,
  thresholds: MeshThresholds,
  weights: FitnessWeights = {},
): number {
  const stableStatus = thresholds.stableStatus ?? 'ANYONIC_FLUX_STABLE';
  if (metrics.status !== stableStatus) {
    return 0.0;
  }

  const wLatency = weights.latencyWeight ?? 0.35;
  const wNodes = weights.nodesWeight ?? 0.25;
  const wCop = weights.copWeight ?? 0.20;
  const wBandwidth = weights.bandwidthWeight ?? 0.20;

  const latencyFactor = Math.max(0, 1 - metrics.latencyNanos / thresholds.maxLatencyNs);
  const nodeFactor = Math.min(1.0, metrics.nodeCount / thresholds.minNodes);
  const copFactor = Math.min(1.0, metrics.copRatio / thresholds.minCop);
  const bandwidthLimit = thresholds.maxBandwidthPb ?? 100_000;
  const bandwidthFactor = Math.min(1.0, metrics.bandwidthPetabytes / bandwidthLimit);

  const compositeScore =
    latencyFactor * wLatency +
    nodeFactor * wNodes +
    copFactor * wCop +
    bandwidthFactor * wBandwidth;

  return Number(compositeScore.toFixed(4));
}

/**
 * Selects highest fitness compute mesh from available stable meshes.
 */
export function selectOptimalMesh<T>(
  stableMeshes: T[],
  config: DispatchPlanConfig<T>,
): { bestMesh: T; bestRef: string; highestScore: number } {
  const getFitness = config.fitnessFn ?? (() => 1.0);
  const getRef =
    config.refGetter ??
    ((m: T) => {
      const item = m as Record<string, unknown>;
      return (
        item.meshRef ??
        item.matrixRef ??
        item.gridNodeId ??
        item.matrixNodeId ??
        item.latticeRef ??
        'UNKNOWN_MESH'
      ) as string;
    });

  let bestMesh = stableMeshes[0];
  let highestScore = getFitness(bestMesh);

  for (let i = 1; i < stableMeshes.length; i++) {
    const score = getFitness(stableMeshes[i]);
    if (score > highestScore) {
      highestScore = score;
      bestMesh = stableMeshes[i];
    }
  }

  return {
    bestMesh,
    bestRef: getRef(bestMesh),
    highestScore,
  };
}
