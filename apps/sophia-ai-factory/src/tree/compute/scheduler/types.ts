/**
 * @module tree/compute/scheduler/types
 * Type definitions for Sub-Planck compute mesh scheduling and dispatch planning.
 */

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
