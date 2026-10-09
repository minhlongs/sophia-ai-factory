/**
 * @file domain-models.ts
 * @description Domain entity models for GPU compute node, failover event, dispatch, and escrow.
 * @layer seed
 */

import type {
  GpuComputeRegion,
  GpuProvider,
  GpuModel,
  GpuNodeStatus,
  VideoCodec,
  VideoResolution,
  DispatchStatus,
  SixNinesBreachTier,
  EscrowStatus,
} from './enums';

export interface GpuComputeNode {
  id: string;
  nodeId: string;
  region: GpuComputeRegion;
  provider: GpuProvider;
  gpuModel: GpuModel;
  gpuCount: number;
  vramGbPerGpu: number;
  totalVramGb: number;
  status: GpuNodeStatus;
  currentLoadPct: number;
  activeRenderJobs: number;
  maxConcurrency: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  spotPriceCentsPerHour: number;
  onDemandPriceCentsPerHour: number;
  supportedCodecs: VideoCodec[];
  maxResolution: VideoResolution;
  healthScore: number;
  isHealthy: boolean;
  totalRendersCompleted: number;
  totalRenderSeconds: number;
  lastHeartbeatAt: number;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface FailoverEvent {
  fromNodeId: string;
  toNodeId: string;
  reason: string;
  reroutedAt: number;
  durationMs: number;
}

export interface VideoRenderDispatch {
  id: string;
  dispatchId: string;
  tenantId: string;
  jobId: string;
  nodeId: string;
  videoResolution: VideoResolution;
  videoDurationSeconds: number;
  frameCount: number;
  codec: VideoCodec;
  status: DispatchStatus;
  priorityScore: number;
  spotPricingApplied: boolean;
  costCents: number;
  queueWaitMs: number;
  renderDurationMs: number | null;
  egressBytes: number;
  slaTargetMs: number;
  slaBreached: boolean;
  rerouteCount: number;
  failoverHistory: FailoverEvent[];
  errorMessage: string | null;
  dispatchedAt: number;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SlaPenaltyEscrow {
  id: string;
  escrowId: string;
  tenantId: string;
  contractId: string;
  periodMonth: string;
  targetSlaPct: number;
  actualUptimePct: number;
  totalPeriodSeconds: number;
  allowedDowntimeSeconds: number;
  downtimeSeconds: number;
  errorBudgetConsumedSeconds: number;
  errorBudgetRemainingSeconds: number;
  escrowFundedCents: number;
  penaltyClaimedCents: number;
  escrowBalanceCents: number;
  breachTier: SixNinesBreachTier;
  penaltyPct: number;
  escrowStatus: EscrowStatus;
  lastBreachTimestamp: number | null;
  auditHash: string;
  createdAt: number;
  updatedAt: number;
}
