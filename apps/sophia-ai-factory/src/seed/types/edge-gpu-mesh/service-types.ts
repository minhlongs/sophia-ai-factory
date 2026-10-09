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
  SixNinesBreachTier,
  EscrowStatus,
} from './enums';

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

export interface FundEscrowInput {
  tenantId: string;
  contractId: string;
  periodMonth: string;
  monthlyContractValueCents: number;
  depositPct?: number;
}

export interface SixNinesSlaMetrics {
  targetSlaPct: number;
  actualUptimePct: number;
  totalPeriodSeconds: number;
  allowedDowntimeSeconds: number;
  downtimeSeconds: number;
  errorBudgetAllocatedSeconds: number;
  errorBudgetConsumedSeconds: number;
  errorBudgetRemainingSeconds: number;
  errorBudgetBurnRatePct: number;
  breachTier: SixNinesBreachTier;
  penaltyPct: number;
}

export interface SixNinesEvaluationResult {
  escrowId: string;
  tenantId: string;
  contractId: string;
  periodMonth: string;
  metrics: SixNinesSlaMetrics;
  penaltyCents: number;
  escrowBalanceCents: number;
  breachTier: SixNinesBreachTier;
  evaluatedAt: number;
  auditHash: string;
}

export interface PenaltyClaimResult {
  escrowId: string;
  tenantId: string;
  claimedCents: number;
  remainingEscrowCents: number;
  status: EscrowStatus;
  claimedAt: number;
}

export interface EscrowReleaseResult {
  escrowId: string;
  releasedCents: number;
  status: 'released_to_revenue';
  releasedAt: number;
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
