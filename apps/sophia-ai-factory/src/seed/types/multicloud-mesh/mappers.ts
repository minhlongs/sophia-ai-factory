/**
 * D1 Row to Domain Entity Mappers for Multi-Cloud Edge Federation & Storage
 *
 * Layer: seed/types/multicloud-mesh
 */

import type {
  MulticloudEdgeRegionRow,
  MulticloudEdgeRegion,
  ZeroEgressStoragePoolRow,
  ZeroEgressStoragePool,
} from './types';
import type {
  CloudFailoverAuditLogRow,
  CloudFailoverAuditLog,
} from './failover-types';

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function mapRowToEdgeRegion(row: MulticloudEdgeRegionRow): MulticloudEdgeRegion {
  return {
    id: row.id,
    regionCode: row.region_code,
    provider: row.provider,
    tierRole: row.tier_role,
    status: row.status,
    endpointUrl: row.endpoint_url,
    geographicZone: row.geographic_zone,
    latitude: row.latitude,
    longitude: row.longitude,
    p95LatencyMs: row.p95_latency_ms,
    p99LatencyMs: row.p99_latency_ms,
    healthScore: row.health_score,
    consecutiveHealthFailures: row.consecutive_health_failures,
    isHealthy: row.is_healthy === 1,
    activeRequests: row.active_requests,
    maxConcurrency: row.max_concurrency,
    gpuCapacityTotal: row.gpu_capacity_total,
    gpuCapacityAllocated: row.gpu_capacity_allocated,
    costPerMRequestsCents: row.cost_per_m_requests_cents,
    egressCostPerGbCents: row.egress_cost_per_gb_cents,
    lastHeartbeatAt: row.last_heartbeat_at,
    capabilities: safeParseJson<string[]>(row.capabilities_json, []),
    metadata: safeParseJson<Record<string, unknown>>(row.metadata_json, {}),
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
  };
}

export function mapRowToStoragePool(row: ZeroEgressStoragePoolRow): ZeroEgressStoragePool {
  return {
    id: row.id,
    poolKey: row.pool_key,
    provider: row.provider,
    role: row.role,
    bucketName: row.bucket_name,
    endpointUrl: row.endpoint_url,
    regionZone: row.region_zone,
    isZeroEgress: row.is_zero_egress === 1,
    totalStoredBytes: row.total_stored_bytes,
    totalObjectsCount: row.total_objects_count,
    syncState: row.sync_state,
    replicationLagMs: row.replication_lag_ms,
    latestSha256Root: row.latest_sha256_root,
    egressRateCentsPerGb: row.egress_rate_cents_per_gb,
    status: row.status,
    readPriority: row.read_priority,
    lastHealthCheckAt: row.last_health_check_at,
    metadata: safeParseJson<Record<string, unknown>>(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRowToFailoverAuditLog(row: CloudFailoverAuditLogRow): CloudFailoverAuditLog {
  return {
    id: row.id,
    incidentCode: row.incident_code,
    originRegionId: row.origin_region_id,
    destinationRegionId: row.destination_region_id,
    triggerReason: row.trigger_reason,
    detectionLatencyMs: row.detection_latency_ms,
    failoverDurationMs: row.failover_duration_ms,
    isSub30ms: row.is_sub_30ms === 1,
    trafficShiftPct: row.traffic_shift_pct,
    requestsDiverted: row.requests_diverted,
    errorRateBefore: row.error_rate_before,
    errorRateAfter: row.error_rate_after,
    status: row.status,
    actorType: row.actor_type,
    telemetrySnapshot: safeParseJson<Record<string, unknown>>(row.telemetry_snapshot_json, {}),
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}
