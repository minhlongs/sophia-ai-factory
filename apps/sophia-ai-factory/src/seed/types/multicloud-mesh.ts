/**
 * Pure Domain Contracts, Interfaces, and Row Mappers: Multi-Cloud Edge Federation & Zero-Egress Storage Fabric
 *
 * Layer: seed/types (Foundational - ZERO upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * Milestone: Gate 9 — $2,500,000 MRR Scale & Global Federation
 *
 * Covers:
 * - Multi-Cloud Edge Regions (Cloudflare Workers, AWS Lambda@Edge, GCP Cloud Run GPU)
 * - Zero-Egress Storage Pools (Cloudflare R2, Backblaze B2, AWS S3 Replica)
 * - Sub-30ms Cloud Failover Audit Logs & Anomaly Telemetry
 * - Cryptographic SHA-256 Manifest Verification
 * - Zero :any rule strictly enforced
 *
 * @module seed/types/multicloud-mesh
 */

// ── Multi-Cloud Provider & Role Contracts ─────────────────────────────────

export const CLOUD_PROVIDERS = ['cloudflare', 'aws', 'gcp', 'hybrid'] as const;
export type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

export const EDGE_TIER_ROLES = [
  'primary_edge',
  'fallback_edge',
  'gpu_burst_node',
  'storage_mesh_gateway',
] as const;
export type EdgeTierRole = (typeof EDGE_TIER_ROLES)[number];

export const REGION_STATUSES = [
  'active',
  'degraded',
  'failing',
  'draining',
  'offline',
] as const;
export type RegionStatus = (typeof REGION_STATUSES)[number];

export const GEOGRAPHIC_ZONES = ['apac', 'nam', 'emea', 'latam', 'global'] as const;
export type GeographicZone = (typeof GEOGRAPHIC_ZONES)[number];

// ── Database Row: multicloud_edge_regions ─────────────────────────────────

export interface MulticloudEdgeRegionRow {
  id: string;
  region_code: string;
  provider: CloudProvider;
  tier_role: EdgeTierRole;
  status: RegionStatus;
  endpoint_url: string;
  geographic_zone: GeographicZone;
  latitude: number | null;
  longitude: number | null;
  p95_latency_ms: number;
  p99_latency_ms: number;
  health_score: number;
  consecutive_health_failures: number;
  is_healthy: number; // 0 | 1
  active_requests: number;
  max_concurrency: number;
  gpu_capacity_total: number;
  gpu_capacity_allocated: number;
  cost_per_m_requests_cents: number;
  egress_cost_per_gb_cents: number;
  last_heartbeat_at: number;
  capabilities_json: string;
  metadata_json: string;
  registered_at: number;
  updated_at: number;
}

// ── Domain Model: MulticloudEdgeRegion ────────────────────────────────────

export interface MulticloudEdgeRegion {
  id: string;
  regionCode: string;
  provider: CloudProvider;
  tierRole: EdgeTierRole;
  status: RegionStatus;
  endpointUrl: string;
  geographicZone: GeographicZone;
  latitude: number | null;
  longitude: number | null;
  p95LatencyMs: number;
  p99LatencyMs: number;
  healthScore: number;
  consecutiveHealthFailures: number;
  isHealthy: boolean;
  activeRequests: number;
  maxConcurrency: number;
  gpuCapacityTotal: number;
  gpuCapacityAllocated: number;
  costPerMRequestsCents: number;
  egressCostPerGbCents: number;
  lastHeartbeatAt: number;
  capabilities: string[];
  metadata: Record<string, unknown>;
  registeredAt: number;
  updatedAt: number;
}

// ── Storage Pool Contracts ───────────────────────────────────────────────

export const STORAGE_PROVIDERS = [
  'cloudflare_r2',
  'aws_s3',
  'backblaze_b2',
  'gcp_storage',
] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

export const STORAGE_POOL_ROLES = [
  'primary',
  'replica',
  'archive',
  'cache_mirror',
] as const;
export type StoragePoolRole = (typeof STORAGE_POOL_ROLES)[number];

export const STORAGE_SYNC_STATES = [
  'synced',
  'syncing',
  'lagging',
  'degraded',
  'error',
] as const;
export type StorageSyncState = (typeof STORAGE_SYNC_STATES)[number];

export const STORAGE_POOL_STATUSES = [
  'active',
  'degraded',
  'maintenance',
  'offline',
] as const;
export type StoragePoolStatus = (typeof STORAGE_POOL_STATUSES)[number];

// ── Database Row: zero_egress_storage_pools ───────────────────────────────

export interface ZeroEgressStoragePoolRow {
  id: string;
  pool_key: string;
  provider: StorageProvider;
  role: StoragePoolRole;
  bucket_name: string;
  endpoint_url: string;
  region_zone: GeographicZone;
  is_zero_egress: number; // 0 | 1
  total_stored_bytes: number;
  total_objects_count: number;
  sync_state: StorageSyncState;
  replication_lag_ms: number;
  latest_sha256_root: string | null;
  egress_rate_cents_per_gb: number;
  status: StoragePoolStatus;
  read_priority: number;
  last_health_check_at: number;
  metadata_json: string;
  created_at: number;
  updated_at: number;
}

// ── Domain Model: ZeroEgressStoragePool ───────────────────────────────────

export interface ZeroEgressStoragePool {
  id: string;
  poolKey: string;
  provider: StorageProvider;
  role: StoragePoolRole;
  bucketName: string;
  endpointUrl: string;
  regionZone: GeographicZone;
  isZeroEgress: boolean;
  totalStoredBytes: number;
  totalObjectsCount: number;
  syncState: StorageSyncState;
  replicationLagMs: number;
  latestSha256Root: string | null;
  egressRateCentsPerGb: number;
  status: StoragePoolStatus;
  readPriority: number;
  lastHealthCheckAt: number;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// ── Cloud Failover Audit Contracts ────────────────────────────────────────

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

// ── Database Row: cloud_failover_audit_log ────────────────────────────────

export interface CloudFailoverAuditLogRow {
  id: string;
  incident_code: string;
  origin_region_id: string;
  destination_region_id: string;
  trigger_reason: FailoverTriggerReason;
  detection_latency_ms: number;
  failover_duration_ms: number;
  is_sub_30ms: number; // 0 | 1
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

// ── Domain Model: CloudFailoverAuditLog ───────────────────────────────────

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

// ── Request & Action Inputs / DTOs ────────────────────────────────────────

export interface RouteRequestInput {
  clientIp?: string;
  geographicZone: GeographicZone;
  workloadType: 'standard_edge_api' | 'video_generation_burst' | 'asset_download';
  requiredGpuUnits?: number;
  maxAcceptableLatencyMs?: number;
}

export interface RouteDecisionResult {
  selectedRegionId: string;
  regionCode: string;
  provider: CloudProvider;
  tierRole: EdgeTierRole;
  targetEndpointUrl: string;
  estimatedLatencyMs: number;
  isGpuBurst: boolean;
  isFallback: boolean;
  routingReason: string;
  resolvedAt: number;
}

export interface TriggerFailoverInput {
  originRegionId: string;
  destinationRegionId?: string;
  triggerReason: FailoverTriggerReason;
  errorRateBefore?: number;
  requestsDiverted?: number;
  actorType?: FailoverActorType;
  telemetrySnapshot?: Record<string, unknown>;
}

export interface FailoverExecutionResult {
  incidentCode: string;
  originRegionId: string;
  destinationRegionId: string;
  failoverDurationMs: number;
  isSub30ms: boolean;
  status: FailoverStatus;
  trafficShiftPct: number;
}

export interface ZeroEgressAssetRoutingInput {
  assetKey: string;
  expectedSha256?: string;
  preferredZone?: GeographicZone;
  isStreamingPlayback?: boolean;
}

export interface ZeroEgressRouteResult {
  downloadUrl: string;
  storagePoolKey: string;
  provider: StorageProvider;
  isZeroEgress: boolean;
  sha256Hash: string;
  integrityVerified: boolean;
  egressCostCents: number;
}

export interface ReplicationSyncInput {
  assetKey: string;
  sourcePoolKey: string;
  targetPoolKey: string;
  sha256Hash: string;
  fileSizeBytes: number;
}

export interface RegisterEdgeRegionInput {
  id?: string;
  regionCode: string;
  provider: CloudProvider;
  tierRole: EdgeTierRole;
  endpointUrl: string;
  geographicZone: GeographicZone;
  latitude?: number;
  longitude?: number;
  maxConcurrency?: number;
  gpuCapacityTotal?: number;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface HeartbeatRegionInput {
  regionId: string;
  p95LatencyMs: number;
  p99LatencyMs: number;
  healthScore: number;
  activeRequests: number;
  consecutiveFailures?: number;
  gpuCapacityAllocated?: number;
}

export interface MulticloudMeshTopology {
  totalRegions: number;
  activeRegionsCount: number;
  degradedRegionsCount: number;
  primaryEdgeRegionId: string | null;
  regionalBreakdown: Record<GeographicZone, number>;
  regions: MulticloudEdgeRegion[];
}

export interface ZeroEgressFabricStatus {
  totalStorageBytes: number;
  totalObjectsCount: number;
  primaryPoolKey: string;
  pools: ZeroEgressStoragePool[];
  overallZeroEgressCompliance: boolean;
}

export interface MulticloudActionError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ── Row Mappers ──────────────────────────────────────────────────────────

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
