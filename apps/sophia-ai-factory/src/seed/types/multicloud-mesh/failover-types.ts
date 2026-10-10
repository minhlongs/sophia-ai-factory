/**
 * Cloud Failover Audit Contracts & Types
 *
 * Layer: seed/types/multicloud-mesh
 */

export const FAILOVER_TRIGGER_REASONS = [
  'p95_latency_spike',
  'health_check_timeout',
  'http_5xx_rate_exceeded',
  'network_partition_split_brain',
  'gpu_burst_capacity_exhaustion',
  'manual_operator_drain',
] as const;
export type FailoverTriggerReason = (typeof FAILOVER_TRIGGER_REASONS)[number];

export const FAILOVER_STATUSES = [
  'evaluating',
  'executed',
  'reverted',
  'failed',
] as const;
export type FailoverStatus = (typeof FAILOVER_STATUSES)[number];

export const FAILOVER_ACTOR_TYPES = [
  'autonomous_sentinel',
  'circuit_breaker',
  'operator_admin',
  'chaos_simulation',
] as const;
export type FailoverActorType = (typeof FAILOVER_ACTOR_TYPES)[number];

export interface CloudFailoverAuditLogRow {
  id: string;
  incident_code: string;
  origin_region_id: string;
  destination_region_id: string;
  trigger_reason: FailoverTriggerReason;
  detection_latency_ms: number;
  failover_duration_ms: number;
  is_sub_30ms: number;
  traffic_shift_pct: number;
  requests_diverted: number;
  error_rate_before: number;
  error_rate_after: number;
  status: FailoverStatus;
  actor_type: FailoverActorType;
  telemetry_snapshot_json: string;
  occurred_at: number;
  created_at: number;
}

export interface CloudFailoverAuditLog {
  id: string;
  incidentCode: string;
  originRegionId: string;
  destinationRegionId: string;
  triggerReason: FailoverTriggerReason;
  detectionLatencyMs: number;
  failoverDurationMs: number;
  isSub30ms: boolean;
  trafficShiftPct: number;
  requestsDiverted: number;
  errorRateBefore: number;
  errorRateAfter: number;
  status: FailoverStatus;
  actorType: FailoverActorType;
  telemetrySnapshot: Record<string, unknown>;
  occurredAt: number;
  createdAt: number;
}
