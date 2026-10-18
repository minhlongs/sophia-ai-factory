/**
 * @file service-types.ts
 * @description Input, result, capacity, and metrics interfaces for Edge GPU Mesh operations.
 * @layer seed
 */

import type {
  GpuComputeRegion,
  GpuModel,
  VideoResolution,
  VideoCodec,
} from './enums';

export {
  type FundEscrowInput,
  type SixNinesSlaMetrics,
  type SixNinesEvaluationResult,
  type PenaltyClaimResult,
  type EscrowReleaseResult,
} from './escrow-types';

export interface VideoRenderJobInput {
  jobId: string;
  tenantId: string;
  videoResolution: VideoResolution;
  videoDurationSeconds: number;
  frameCount: number;
  codec?: VideoCodec;
  preferredRegion?: GpuComputeRegion;
  priorityScore?: number;
  allowSpot?: boolean;
}

export interface DispatchResult {
  dispatchId: string;
  jobId: string;
  tenantId: string;
  selectedNodeId: string;
  nodeRegion: GpuComputeRegion;
  gpuModel: GpuModel;
  estimatedCostCents: number;
  estimatedDurationMs: number;
  slaTargetMs: number;
  dispatchedAt: number;
}

export interface RerouteResult {
  success: boolean;
  dispatchId: string;
  previousNodeId: string;
  newNodeId: string;
  rerouteDurationMs: number;
  isSub20ms: boolean;
  timestamp: number;
}

export interface CompleteJobResult {
  dispatchId: string;
  jobId: string;
  status: 'completed' | 'failed';
  renderDurationMs: number;
  slaBreached: boolean;
  actualCostCents: number;
  completedAt: number;
}

export interface RegionCapacity {
  region: GpuComputeRegion;
  totalNodes: number;
  onlineNodes: number;
  totalGpus: number;
  totalVramGb: number;
  averageLoadPct: number;
  activeRenderJobs: number;
}

export interface GpuMeshTopology {
  totalNodes: number;
  onlineNodes: number;
  degradedNodes: number;
  totalGpus: number;
  totalVramGb: number;
  activeRenderJobs: number;
  averageLoadPct: number;
  regionCapacities: RegionCapacity[];
  modelsSummary: Record<GpuModel, { count: number; online: number; activeJobs: number }>;
}
