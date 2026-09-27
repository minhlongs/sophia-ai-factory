/**
 * Edge GPU Video Mesh, Dynamic Workload Balancer & 6-Nines SLA Escrow Types
 *
 * Layer: seed/types (Foundational — zero external runtime dependencies, 0 upper layer imports)
 *
 * Gate 10 Milestone: $5,000,000 MRR ($60,000,000 ARR, 20,000 Paid Customers, 99.9999% SLA)
 *
 * @module seed/types/edge-gpu-mesh
 */

import { z } from 'zod';

// ============================================================================
// Gate 10 Milestone Constants
// ============================================================================

export const GATE_10_CONSTANTS = {
  TARGET_MRR_CENTS: 500_000_000, // $5,000,000.00 USD
  TARGET_ARR_CENTS: 6_000_000_000, // $60,000,000.00 USD
  TARGET_CUSTOMERS: 20_000,
  TARGET_ARPU_CENTS: 25_000, // $250.00 USD
  TARGET_NRR_PCT: 140.0, // >= 140.0%
  TARGET_GRR_PCT: 95.0, // >= 95.0%
  SIX_NINES_SLA_PCT: 99.9999, // 99.9999% Ultra-SLA
  MONTHLY_PERIOD_SECONDS: 2_592_000, // 30 days * 86,400s
  SIX_NINES_ALLOWED_DOWNTIME_SECONDS: 2.592, // Exactly 2,592,000 * 0.000001 = 2.592s
  FOUR_K_MAX_RENDER_MS: 15_000, // 15,000ms = 15 seconds target
  FAILOVER_MAX_REROUTE_MS: 20, // Sub-20ms failover rerouting target
  DEFAULT_ESCROW_DEPOSIT_PCT: 20.0, // 20% of monthly contract value deposited into escrow
} as const;

// ============================================================================
// Region & Hardware Enums
// ============================================================================

export type GpuComputeRegion =
  | 'apac-tokyo'
  | 'apac-singapore'
  | 'apac-vietnam'
  | 'us-east-iad'
  | 'us-west-sfo'
  | 'eu-west-fra'
  | 'eu-central-ams';

export const ALL_GPU_COMPUTE_REGIONS: readonly GpuComputeRegion[] = [
  'apac-tokyo',
  'apac-singapore',
  'apac-vietnam',
  'us-east-iad',
  'us-west-sfo',
  'eu-west-fra',
  'eu-central-ams',
] as const;

export function isGpuComputeRegion(value: unknown): value is GpuComputeRegion {
  return typeof value === 'string' && ALL_GPU_COMPUTE_REGIONS.includes(value as GpuComputeRegion);
}

export type GpuProvider = 'cloud' | 'bare_metal' | 'edge_mesh' | 'hybrid';

export const ALL_GPU_PROVIDERS: readonly GpuProvider[] = [
  'cloud',
  'bare_metal',
  'edge_mesh',
  'hybrid',
] as const;

export type GpuModel = 'H100' | 'A100' | 'L40S' | 'RTX4090';

export const ALL_GPU_MODELS: readonly GpuModel[] = [
  'H100',
  'A100',
  'L40S',
  'RTX4090',
] as const;

export function isGpuModel(value: unknown): value is GpuModel {
  return typeof value === 'string' && ALL_GPU_MODELS.includes(value as GpuModel);
}

export type GpuNodeStatus = 'online' | 'busy' | 'degraded' | 'draining' | 'offline';

export const ALL_GPU_NODE_STATUSES: readonly GpuNodeStatus[] = [
  'online',
  'busy',
  'degraded',
  'draining',
  'offline',
] as const;

export type VideoResolution = '720p' | '1080p' | '4K' | '8K';

export const ALL_VIDEO_RESOLUTIONS: readonly VideoResolution[] = [
  '720p',
  '1080p',
  '4K',
  '8K',
] as const;

export type VideoCodec = 'h264' | 'hevc' | 'av1' | 'prores';

export const ALL_VIDEO_CODECS: readonly VideoCodec[] = [
  'h264',
  'hevc',
  'av1',
  'prores',
] as const;

export type DispatchStatus =
  | 'pending'
  | 'dispatched'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'rerouted';

export const ALL_DISPATCH_STATUSES: readonly DispatchStatus[] = [
  'pending',
  'dispatched',
  'rendering',
  'completed',
  'failed',
  'rerouted',
] as const;

export type SixNinesBreachTier =
  | 'none'
  | 'minor'
  | 'moderate'
  | 'major'
  | 'catastrophic';

export const ALL_BREACH_TIERS: readonly SixNinesBreachTier[] = [
  'none',
  'minor',
  'moderate',
  'major',
  'catastrophic',
] as const;

export type EscrowStatus =
  | 'locked'
  | 'partially_disbursed'
  | 'fully_disbursed'
  | 'released_to_revenue';

export const ALL_ESCROW_STATUSES: readonly EscrowStatus[] = [
  'locked',
  'partially_disbursed',
  'fully_disbursed',
  'released_to_revenue',
] as const;

// ============================================================================
// Balancing & Allocation Rule Tables
// ============================================================================

export const FITNESS_WEIGHTS = {
  LOAD: 0.35,
  LATENCY: 0.25,
  SPOT_PRICE: 0.20,
  HEALTH: 0.20,
} as const;

export const RESOLUTION_VRAM_MIN_GB: Record<VideoResolution, number> = {
  '720p': 16,
  '1080p': 24,
  '4K': 48,
  '8K': 80,
} as const;

export const BREACH_PENALTY_PCT: Record<SixNinesBreachTier, number> = {
  none: 0.0,
  minor: 15.0,
  moderate: 35.0,
  major: 70.0,
  catastrophic: 100.0,
} as const;

// ============================================================================
// Database Row Interfaces
// ============================================================================

export interface GpuComputeNodeDbRow {
  id: string;
  node_id: string;
  region: string;
  provider: string;
  gpu_model: string;
  gpu_count: number;
  vram_gb_per_gpu: number;
  total_vram_gb: number;
  status: string;
  current_load_pct: number;
  active_render_jobs: number;
  max_concurrency: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  spot_price_cents_per_hour: number;
  on_demand_price_cents_per_hour: number;
  supported_codecs_json: string;
  max_resolution: string;
  health_score: number;
  is_healthy: number;
  total_renders_completed: number;
  total_render_seconds: number;
  last_heartbeat_at: number;
  metadata_json: string;
  created_at: number;
  updated_at: number;
}

export interface VideoRenderDispatchDbRow {
  id: string;
  dispatch_id: string;
  tenant_id: string;
  job_id: string;
  node_id: string;
  video_resolution: string;
  video_duration_seconds: number;
  frame_count: number;
  codec: string;
  status: string;
  priority_score: number;
  spot_pricing_applied: number;
  cost_cents: number;
  queue_wait_ms: number;
  render_duration_ms: number | null;
  egress_bytes: number;
  sla_target_ms: number;
  sla_breached: number;
  reroute_count: number;
  failover_history_json: string;
  error_message: string | null;
  dispatched_at: number;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface SlaPenaltyEscrowDbRow {
  id: string;
  escrow_id: string;
  tenant_id: string;
  contract_id: string;
  period_month: string;
  target_sla_pct: number;
  actual_uptime_pct: number;
  total_period_seconds: number;
  allowed_downtime_seconds: number;
  downtime_seconds: number;
  error_budget_consumed_seconds: number;
  error_budget_remaining_seconds: number;
  escrow_funded_cents: number;
  penalty_claimed_cents: number;
  escrow_balance_cents: number;
  breach_tier: string;
  penalty_pct: number;
  escrow_status: string;
  last_breach_timestamp: number | null;
  audit_hash: string;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// Domain Entity Models
// ============================================================================

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

// ============================================================================
// Service Inputs and Results
// ============================================================================

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

// ============================================================================
// Row Mappers
// ============================================================================

export function mapRowToGpuComputeNode(row: GpuComputeNodeDbRow): GpuComputeNode {
  let supportedCodecs: VideoCodec[] = ['h264', 'hevc'];
  try {
    supportedCodecs = JSON.parse(row.supported_codecs_json || '[]') as VideoCodec[];
  } catch {
    supportedCodecs = ['h264', 'hevc'];
  }

  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata_json || '{}') as Record<string, unknown>;
  } catch {
    metadata = {};
  }

  return {
    id: row.id,
    nodeId: row.node_id,
    region: row.region as GpuComputeRegion,
    provider: row.provider as GpuProvider,
    gpuModel: row.gpu_model as GpuModel,
    gpuCount: Number(row.gpu_count),
    vramGbPerGpu: Number(row.vram_gb_per_gpu),
    totalVramGb: Number(row.total_vram_gb),
    status: row.status as GpuNodeStatus,
    currentLoadPct: Number(row.current_load_pct),
    activeRenderJobs: Number(row.active_render_jobs),
    maxConcurrency: Number(row.max_concurrency),
    p95LatencyMs: Number(row.p95_latency_ms),
    p99LatencyMs: Number(row.p99_latency_ms),
    spotPriceCentsPerHour: Number(row.spot_price_cents_per_hour),
    onDemandPriceCentsPerHour: Number(row.on_demand_price_cents_per_hour),
    supportedCodecs,
    maxResolution: row.max_resolution as VideoResolution,
    healthScore: Number(row.health_score),
    isHealthy: Boolean(row.is_healthy),
    totalRendersCompleted: Number(row.total_renders_completed),
    totalRenderSeconds: Number(row.total_render_seconds),
    lastHeartbeatAt: Number(row.last_heartbeat_at),
    metadata,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function mapRowToVideoRenderDispatch(row: VideoRenderDispatchDbRow): VideoRenderDispatch {
  let failoverHistory: FailoverEvent[] = [];
  try {
    failoverHistory = JSON.parse(row.failover_history_json || '[]') as FailoverEvent[];
  } catch {
    failoverHistory = [];
  }

  return {
    id: row.id,
    dispatchId: row.dispatch_id,
    tenantId: row.tenant_id,
    jobId: row.job_id,
    nodeId: row.node_id,
    videoResolution: row.video_resolution as VideoResolution,
    videoDurationSeconds: Number(row.video_duration_seconds),
    frameCount: Number(row.frame_count),
    codec: row.codec as VideoCodec,
    status: row.status as DispatchStatus,
    priorityScore: Number(row.priority_score),
    spotPricingApplied: Boolean(row.spot_pricing_applied),
    costCents: Number(row.cost_cents),
    queueWaitMs: Number(row.queue_wait_ms),
    renderDurationMs: row.render_duration_ms !== null ? Number(row.render_duration_ms) : null,
    egressBytes: Number(row.egress_bytes),
    slaTargetMs: Number(row.sla_target_ms),
    slaBreached: Boolean(row.sla_breached),
    rerouteCount: Number(row.reroute_count),
    failoverHistory,
    errorMessage: row.error_message,
    dispatchedAt: Number(row.dispatched_at),
    completedAt: row.completed_at !== null ? Number(row.completed_at) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function mapRowToSlaPenaltyEscrow(row: SlaPenaltyEscrowDbRow): SlaPenaltyEscrow {
  return {
    id: row.id,
    escrowId: row.escrow_id,
    tenantId: row.tenant_id,
    contractId: row.contract_id,
    periodMonth: row.period_month,
    targetSlaPct: Number(row.target_sla_pct),
    actualUptimePct: Number(row.actual_uptime_pct),
    totalPeriodSeconds: Number(row.total_period_seconds),
    allowedDowntimeSeconds: Number(row.allowed_downtime_seconds),
    downtimeSeconds: Number(row.downtime_seconds),
    errorBudgetConsumedSeconds: Number(row.error_budget_consumed_seconds),
    errorBudgetRemainingSeconds: Number(row.error_budget_remaining_seconds),
    escrowFundedCents: Number(row.escrow_funded_cents),
    penaltyClaimedCents: Number(row.penalty_claimed_cents),
    escrowBalanceCents: Number(row.escrow_balance_cents),
    breachTier: row.breach_tier as SixNinesBreachTier,
    penaltyPct: Number(row.penalty_pct),
    escrowStatus: row.escrow_status as EscrowStatus,
    lastBreachTimestamp: row.last_breach_timestamp !== null ? Number(row.last_breach_timestamp) : null,
    auditHash: row.audit_hash,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const videoRenderJobInputSchema = z.object({
  jobId: z.string().min(1),
  tenantId: z.string().min(1),
  videoResolution: z.enum(['720p', '1080p', '4K', '8K']),
  videoDurationSeconds: z.number().positive(),
  frameCount: z.number().int().positive(),
  codec: z.enum(['h264', 'hevc', 'av1', 'prores']).optional().default('h264'),
  preferredRegion: z
    .enum([
      'apac-tokyo',
      'apac-singapore',
      'apac-vietnam',
      'us-east-iad',
      'us-west-sfo',
      'eu-west-fra',
      'eu-central-ams',
    ])
    .optional(),
  priorityScore: z.number().int().min(0).optional().default(100),
  allowSpot: z.boolean().optional().default(true),
});

export const fundEscrowInputSchema = z.object({
  tenantId: z.string().min(1),
  contractId: z.string().min(1),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
  monthlyContractValueCents: z.number().int().positive(),
  depositPct: z.number().min(5.0).max(100.0).optional().default(20.0),
});
