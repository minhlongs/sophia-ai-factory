/**
 * Multi-Cloud Edge Federation & Storage Contracts, Rows & Domain Entities
 *
 * Layer: seed/types/multicloud-mesh
 */

import { GEOGRAPHIC_ZONES, type GeographicZone } from './storage-pool-types';

export { GEOGRAPHIC_ZONES, type GeographicZone };

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

export {
  STORAGE_PROVIDERS,
  STORAGE_POOL_ROLES,
  STORAGE_SYNC_STATES,
  STORAGE_POOL_STATUSES,
  type StorageProvider,
  type StoragePoolRole,
  type StorageSyncState,
  type StoragePoolStatus,
  type ZeroEgressStoragePoolRow,
  type ZeroEgressStoragePool,
} from './storage-pool-types';
