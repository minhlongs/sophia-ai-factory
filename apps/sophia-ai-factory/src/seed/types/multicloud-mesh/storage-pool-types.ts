/**
 * Multi-Cloud Zero-Egress Storage Pool Contracts, Rows & Domain Entities
 *
 * Layer: seed/types/multicloud-mesh
 */

export const GEOGRAPHIC_ZONES = ['apac', 'nam', 'emea', 'latam', 'global'] as const;
export type GeographicZone = (typeof GEOGRAPHIC_ZONES)[number];

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
