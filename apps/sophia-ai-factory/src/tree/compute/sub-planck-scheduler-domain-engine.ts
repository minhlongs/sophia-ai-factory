/**
 * @file sub-planck-scheduler-domain-engine.ts
 * @layer tree/compute
 * @description Canonical parameterized domain engine for Sub-Planck Mesh Fitness & Workload Batch Dispatch Planning.
 */

import { createHash } from 'node:crypto';

export interface ComputeMeshMetrics {
  status: string;
  latencyNanos: number;
  nodeCount: number;
  copRatio: number;
  bandwidthPetabytes: number;
  clockDriftFs?: number;
}

export interface MeshThresholds {
  maxLatencyNs: number;
  minNodes: number;
  minCop: number;
  maxBandwidthPb?: number;
  stableStatus?: string;
}

export interface FitnessWeights {
  latencyWeight?: number;
  nodesWeight?: number;
  copWeight?: number;
  bandwidthWeight?: number;
}

export interface GenericComputeMeshItem {
  meshRef?: string;
  matrixRef?: string;
  gridNodeId?: string;
  matrixNodeId?: string;
  latticeRef?: string;
  locationSector?: string;
  waveguideLatencyNanos?: number;
  femtosecondVacuumNodesCount?: number;
  vacuumBusBandwidthPetabytes?: number;
  planckClockDriftFs?: number;
  thermalCopRatio?: number;
  vacuumMatrixStatus?: string;
  [key: string]: unknown;
}

export interface DispatchPlanContext {
  targetMeshRef: string;
  assignedWorkloads: number;
  totalBandwidthPetabytes: number;
  measuredDriftFs: number;
  highestScore: number;
}

export interface DispatchPlanConfig<T = unknown> {
  maxClockDriftFs?: number;
  skipDriftCheck?: boolean;
  stableStatus?: string;
  allMeshesStable?: boolean;
  bandwidthPerWorkloadPb?: number;
  fitnessFn?: (mesh: T) => number;
  refGetter?: (mesh: T) => string;
  statusGetter?: (mesh: T) => string;
  hashPrefix?: string;
  dispatchHashFn?: (ctx: DispatchPlanContext) => string;
  zeroStableMeshesErrorMessage?: string;
  clockDriftErrorMessageFn?: (drift: number, limit: number) => string;
  assignedWorkloads?: number;
  totalBandwidthPetabytes?: number;
}

export interface ParameterizedDispatchPlan {
  targetMatrixRef?: string;
  targetMeshRef?: string;
  targetLatticeRef?: string;
  targetGridId?: string;
  targetMatrixId?: string;
  assignedWorkloads: number;
  totalBandwidthPetabytes: number;
  totalOpticalPetabytes?: number;
  planckDriftFs?: number;
  measuredDriftFs?: number;
  measuredDriftPs?: number;
  relativisticDriftFs?: number;
  relativisticDriftPs?: number;
  tachyonDriftFs?: number;
  quantumDriftFs?: number;
  femtosecondDriftFs?: number;
  dispatchHash: string;
}

/**
 * Calculates multi-dimensional scheduling fitness score for a compute mesh.
 */
export function calculateParameterizedMeshFitness(
  metrics: ComputeMeshMetrics,
  thresholds: MeshThresholds,
  weights: FitnessWeights = {}
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
 * Plans dispatch of cognitive workloads to optimal compute mesh.
 */
export function planParameterizedBatchDispatch<T = unknown>(
  meshes: T[],
  workloads: number,
  measuredDriftFs: number,
  config: DispatchPlanConfig<T>
): ParameterizedDispatchPlan {
  let stableMeshes: T[];
  if (config.allMeshesStable) {
    stableMeshes = meshes;
  } else {
    const stableStatus = config.stableStatus ?? 'ANYONIC_FLUX_STABLE';
    const getStatus = config.statusGetter ?? ((m: T) => {
      const item = m as Record<string, unknown>;
      return (item.vacuumMatrixStatus ?? item.meshStatus ?? item.status ?? item.foamLatticeStatus ?? item.superLatticeStatus ?? item.topologicalStatus ?? item.superconductingStatus) as string;
    });

    stableMeshes = meshes.filter((m) => getStatus(m) === stableStatus);
  }

  if (stableMeshes.length === 0) {
    throw new Error(
      config.zeroStableMeshesErrorMessage ??
        'Zero stable compute meshes available for dispatch'
    );
  }

  if (!config.skipDriftCheck && config.maxClockDriftFs !== undefined && measuredDriftFs > config.maxClockDriftFs) {
    throw new Error(
      config.clockDriftErrorMessageFn
        ? config.clockDriftErrorMessageFn(measuredDriftFs, config.maxClockDriftFs)
        : `Planck relativistic clock drift ${measuredDriftFs} exceeds allowable threshold ${config.maxClockDriftFs}`
    );
  }

  const getFitness = config.fitnessFn ?? (() => 1.0);
  const getRef = config.refGetter ?? ((m: T) => {
    const item = m as Record<string, unknown>;
    return (item.meshRef ?? item.matrixRef ?? item.gridNodeId ?? item.matrixNodeId ?? item.latticeRef ?? 'UNKNOWN_MESH') as string;
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

  const bestRef = getRef(bestMesh);
  const assignedWorkloads = config.assignedWorkloads !== undefined ? config.assignedWorkloads : workloads;
  const bwFactor = config.bandwidthPerWorkloadPb ?? 0.0025; // 0.0025 PB per workload
  const totalBandwidthPetabytes = config.totalBandwidthPetabytes !== undefined
    ? config.totalBandwidthPetabytes
    : Number((workloads * bwFactor).toFixed(2));

  const planContext: DispatchPlanContext = {
    targetMeshRef: bestRef,
    assignedWorkloads,
    totalBandwidthPetabytes,
    measuredDriftFs,
    highestScore,
  };

  let dispatchHash: string;
  if (config.dispatchHashFn) {
    dispatchHash = config.dispatchHashFn(planContext);
  } else {
    const prefix = config.hashPrefix ?? 'DISPATCH';
    dispatchHash = createHash('sha256')
      .update(`${prefix}:${bestRef}:${assignedWorkloads}:${totalBandwidthPetabytes}:${measuredDriftFs}`)
      .digest('hex');
  }

  return {
    targetMatrixRef: bestRef,
    targetMeshRef: bestRef,
    targetLatticeRef: bestRef,
    targetGridId: bestRef,
    targetMatrixId: bestRef,
    assignedWorkloads,
    totalBandwidthPetabytes,
    totalOpticalPetabytes: totalBandwidthPetabytes,
    planckDriftFs: measuredDriftFs,
    measuredDriftFs,
    measuredDriftPs: measuredDriftFs,
    relativisticDriftFs: measuredDriftFs,
    relativisticDriftPs: measuredDriftFs,
    tachyonDriftFs: measuredDriftFs,
    quantumDriftFs: measuredDriftFs,
    femtosecondDriftFs: measuredDriftFs,
    dispatchHash,
  };
}
