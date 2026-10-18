/**
 * @file row-mappers.ts
 * @description Database row mappers for edge GPU compute nodes, dispatches, and SLA escrows.
 * @layer seed
 */

import type {
  GpuComputeNodeDbRow,
  VideoRenderDispatchDbRow,
  SlaPenaltyEscrowDbRow,
} from './db-models';
import type {
  GpuComputeNode,
  VideoRenderDispatch,
  SlaPenaltyEscrow,
  FailoverEvent,
} from './domain-models';
import type {
  GpuComputeRegion,
  GpuProvider,
  GpuModel,
  GpuNodeStatus,
  VideoResolution,
  VideoCodec,
  DispatchStatus,
  SixNinesBreachTier,
  EscrowStatus,
} from './enums';

function parseJsonOrFallback<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function mapRowToGpuComputeNode(row: GpuComputeNodeDbRow): GpuComputeNode {
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
    supportedCodecs: parseJsonOrFallback<VideoCodec[]>(row.supported_codecs_json, ['h264', 'hevc']),
    maxResolution: row.max_resolution as VideoResolution,
    healthScore: Number(row.health_score),
    isHealthy: Boolean(row.is_healthy),
    totalRendersCompleted: Number(row.total_renders_completed),
    totalRenderSeconds: Number(row.total_render_seconds),
    lastHeartbeatAt: Number(row.last_heartbeat_at),
    metadata: parseJsonOrFallback<Record<string, unknown>>(row.metadata_json, {}),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function mapRowToVideoRenderDispatch(row: VideoRenderDispatchDbRow): VideoRenderDispatch {
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
    failoverHistory: parseJsonOrFallback<FailoverEvent[]>(row.failover_history_json, []),
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
