/**
 * Multi-Cloud Edge Federation & Storage Contracts, Rows & Domain Entities
 *
 * Layer: seed/types/multicloud-mesh
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
  is_healthy: number;
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
  is_zero_egress: number;
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
