-- Migration 0306: Multi-Cloud Edge Federation & Zero-Egress Storage Fabric
-- Milestone: GATE 9: $2,500,000 MRR ($30,000,000 ARR, 10,000 Paying Customers)
-- Cloudflare D1 SQLite standards: Millisecond Unix timestamps, strict CHECK constraints,
-- foreign key cascades, randomblob hex IDs, sub-30ms failover telemetry, and zero-egress tracking.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. multicloud_edge_regions
-- Global edge computing regions across Cloudflare Workers (primary),
-- AWS Lambda@Edge (fallback), and GCP Cloud Run (GPU video burst nodes).
-- ============================================================================
CREATE TABLE IF NOT EXISTS multicloud_edge_regions (
  id TEXT PRIMARY KEY, -- e.g. 'region_cf_primary_iad', 'region_aws_fallback_iad', 'region_gcp_burst_us'
  region_code TEXT NOT NULL UNIQUE, -- e.g. 'cf-iad', 'aws-us-east-1', 'gcp-us-central1'
  provider TEXT NOT NULL CHECK(provider IN ('cloudflare', 'aws', 'gcp', 'hybrid')),
  tier_role TEXT NOT NULL CHECK(tier_role IN ('primary_edge', 'fallback_edge', 'gpu_burst_node', 'storage_mesh_gateway')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'degraded', 'failing', 'draining', 'offline')),
  endpoint_url TEXT NOT NULL,
  geographic_zone TEXT NOT NULL CHECK(geographic_zone IN ('apac', 'nam', 'emea', 'latam', 'global')),
  latitude REAL,
  longitude REAL,
  p95_latency_ms REAL NOT NULL DEFAULT 15.0 CHECK(p95_latency_ms >= 0.0),
  p99_latency_ms REAL NOT NULL DEFAULT 25.0 CHECK(p99_latency_ms >= 0.0),
  health_score REAL NOT NULL DEFAULT 1.0 CHECK(health_score >= 0.0 AND health_score <= 1.0),
  consecutive_health_failures INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_health_failures >= 0),
  is_healthy INTEGER NOT NULL DEFAULT 1 CHECK(is_healthy IN (0, 1)),
  active_requests INTEGER NOT NULL DEFAULT 0 CHECK(active_requests >= 0),
  max_concurrency INTEGER NOT NULL DEFAULT 5000 CHECK(max_concurrency > 0),
  gpu_capacity_total INTEGER NOT NULL DEFAULT 0 CHECK(gpu_capacity_total >= 0),
  gpu_capacity_allocated INTEGER NOT NULL DEFAULT 0 CHECK(gpu_capacity_allocated >= 0),
  cost_per_m_requests_cents INTEGER NOT NULL DEFAULT 15, -- 15 cents per 1M requests
  egress_cost_per_gb_cents INTEGER NOT NULL DEFAULT 0, -- 0 for Cloudflare Workers
  last_heartbeat_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  capabilities_json TEXT NOT NULL DEFAULT '[]', -- JSON array of capability tags
  metadata_json TEXT NOT NULL DEFAULT '{}',
  registered_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_mer_provider_tier ON multicloud_edge_regions(provider, tier_role, status);
CREATE INDEX IF NOT EXISTS idx_mer_zone_status ON multicloud_edge_regions(geographic_zone, status, is_healthy);
CREATE INDEX IF NOT EXISTS idx_mer_p95_latency ON multicloud_edge_regions(p95_latency_ms, health_score);
CREATE INDEX IF NOT EXISTS idx_mer_heartbeat ON multicloud_edge_regions(last_heartbeat_at);

-- ============================================================================
-- 2. zero_egress_storage_pools
-- Zero-egress asset storage clusters: Cloudflare R2 primary, Backblaze B2
-- archive (Bandwidth Alliance), and AWS S3 replica (disaster recovery).
-- ============================================================================
CREATE TABLE IF NOT EXISTS zero_egress_storage_pools (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pool_key TEXT NOT NULL UNIQUE, -- e.g. 'r2-primary-apac', 's3-replica-nam', 'b2-archive-global'
  provider TEXT NOT NULL CHECK(provider IN ('cloudflare_r2', 'aws_s3', 'backblaze_b2', 'gcp_storage')),
  role TEXT NOT NULL CHECK(role IN ('primary', 'replica', 'archive', 'cache_mirror')),
  bucket_name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  region_zone TEXT NOT NULL CHECK(region_zone IN ('apac', 'nam', 'emea', 'global')),
  is_zero_egress INTEGER NOT NULL DEFAULT 1 CHECK(is_zero_egress IN (0, 1)),
  total_stored_bytes INTEGER NOT NULL DEFAULT 0 CHECK(total_stored_bytes >= 0),
  total_objects_count INTEGER NOT NULL DEFAULT 0 CHECK(total_objects_count >= 0),
  sync_state TEXT NOT NULL DEFAULT 'synced' CHECK(sync_state IN ('synced', 'syncing', 'lagging', 'degraded', 'error')),
  replication_lag_ms INTEGER NOT NULL DEFAULT 0 CHECK(replication_lag_ms >= 0),
  latest_sha256_root TEXT, -- SHA-256 root hash of the pool asset manifest
  egress_rate_cents_per_gb REAL NOT NULL DEFAULT 0.0 CHECK(egress_rate_cents_per_gb >= 0.0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'degraded', 'maintenance', 'offline')),
  read_priority INTEGER NOT NULL DEFAULT 1 CHECK(read_priority >= 1 AND read_priority <= 100), -- 1 = highest
  last_health_check_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_zsp_provider_role ON zero_egress_storage_pools(provider, role, status);
CREATE INDEX IF NOT EXISTS idx_zsp_region_priority ON zero_egress_storage_pools(region_zone, read_priority, status);
CREATE INDEX IF NOT EXISTS idx_zsp_sync_state ON zero_egress_storage_pools(sync_state, replication_lag_ms);

-- ============================================================================
-- 3. cloud_failover_audit_log
-- Monotonically logged sub-30ms traffic failovers upon anomaly detection.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloud_failover_audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  incident_code TEXT NOT NULL UNIQUE, -- e.g. 'FO-20260926-001'
  origin_region_id TEXT NOT NULL REFERENCES multicloud_edge_regions(id) ON DELETE CASCADE,
  destination_region_id TEXT NOT NULL REFERENCES multicloud_edge_regions(id) ON DELETE CASCADE,
  trigger_reason TEXT NOT NULL CHECK(trigger_reason IN (
    'p95_latency_spike', 'health_check_timeout', 'http_5xx_rate_exceeded',
    'network_partition_split_brain', 'gpu_burst_capacity_exhaustion', 'manual_operator_drain'
  )),
  detection_latency_ms REAL NOT NULL CHECK(detection_latency_ms >= 0.0),
  failover_duration_ms REAL NOT NULL CHECK(failover_duration_ms >= 0.0),
  is_sub_30ms INTEGER NOT NULL DEFAULT 1 CHECK(is_sub_30ms IN (0, 1)),
  traffic_shift_pct REAL NOT NULL DEFAULT 100.0 CHECK(traffic_shift_pct >= 0.0 AND traffic_shift_pct <= 100.0),
  requests_diverted INTEGER NOT NULL DEFAULT 0 CHECK(requests_diverted >= 0),
  error_rate_before REAL NOT NULL DEFAULT 0.0 CHECK(error_rate_before >= 0.0 AND error_rate_before <= 1.0),
  error_rate_after REAL NOT NULL DEFAULT 0.0 CHECK(error_rate_after >= 0.0 AND error_rate_after <= 1.0),
  status TEXT NOT NULL DEFAULT 'executed' CHECK(status IN ('evaluating', 'executed', 'reverted', 'failed')),
  actor_type TEXT NOT NULL DEFAULT 'autonomous_sentinel' CHECK(actor_type IN (
    'autonomous_sentinel', 'circuit_breaker', 'operator_admin', 'chaos_simulation'
  )),
  telemetry_snapshot_json TEXT NOT NULL DEFAULT '{}',
  occurred_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_cfal_incident ON cloud_failover_audit_log(incident_code);
CREATE INDEX IF NOT EXISTS idx_cfal_regions ON cloud_failover_audit_log(origin_region_id, destination_region_id);
CREATE INDEX IF NOT EXISTS idx_cfal_trigger ON cloud_failover_audit_log(trigger_reason, status);
CREATE INDEX IF NOT EXISTS idx_cfal_occurred ON cloud_failover_audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cfal_sub_30ms ON cloud_failover_audit_log(is_sub_30ms, failover_duration_ms);

-- ============================================================================
-- 4. Seed Baseline Canonical Multi-Cloud Edge Regions
-- ============================================================================
INSERT OR IGNORE INTO multicloud_edge_regions (
  id, region_code, provider, tier_role, status, endpoint_url, geographic_zone,
  latitude, longitude, p95_latency_ms, p99_latency_ms, health_score, is_healthy,
  max_concurrency, gpu_capacity_total, gpu_capacity_allocated, cost_per_m_requests_cents,
  egress_cost_per_gb_cents, capabilities_json
) VALUES
(
  'region_cf_primary_apac',
  'cf-sin',
  'cloudflare',
  'primary_edge',
  'active',
  'https://apac-edge.sophia.agencyos.network',
  'apac',
  1.3521,
  103.8198,
  12.4,
  18.2,
  1.0,
  1,
  10000,
  0,
  0,
  15,
  0,
  '["anycast_edge", "smart_routing", "d1_proxy", "zero_egress_cache", "c2pa_verification"]'
),
(
  'region_cf_primary_nam',
  'cf-iad',
  'cloudflare',
  'primary_edge',
  'active',
  'https://nam-edge.sophia.agencyos.network',
  'nam',
  39.0438,
  -77.4874,
  11.8,
  17.5,
  1.0,
  1,
  10000,
  0,
  0,
  15,
  0,
  '["anycast_edge", "smart_routing", "d1_proxy", "zero_egress_cache", "c2pa_verification"]'
),
(
  'region_cf_primary_emea',
  'cf-fra',
  'cloudflare',
  'primary_edge',
  'active',
  'https://emea-edge.sophia.agencyos.network',
  'emea',
  50.1109,
  8.6821,
  13.1,
  19.0,
  1.0,
  1,
  10000,
  0,
  0,
  15,
  0,
  '["anycast_edge", "smart_routing", "d1_proxy", "zero_egress_cache", "c2pa_verification"]'
),
(
  'region_aws_fallback_nam',
  'aws-us-east-1',
  'aws',
  'fallback_edge',
  'active',
  'https://aws-edge-nam.sophia.agencyos.network',
  'nam',
  38.9339,
  -77.1773,
  24.5,
  35.2,
  1.0,
  1,
  5000,
  0,
  0,
  20,
  9,
  '["lambda_edge", "fallback_routing", "s3_gateway"]'
),
(
  'region_aws_fallback_apac',
  'aws-ap-southeast-1',
  'aws',
  'fallback_edge',
  'active',
  'https://aws-edge-apac.sophia.agencyos.network',
  'apac',
  1.3521,
  103.8198,
  26.0,
  38.5,
  1.0,
  1,
  5000,
  0,
  0,
  20,
  9,
  '["lambda_edge", "fallback_routing", "s3_gateway"]'
),
(
  'region_gcp_burst_nam',
  'gcp-us-central1',
  'gcp',
  'gpu_burst_node',
  'active',
  'https://gcp-gpu-nam.sophia.agencyos.network',
  'nam',
  41.8781,
  -93.0977,
  32.0,
  45.0,
  1.0,
  1,
  1000,
  64, -- 64x NVIDIA L4 / A100 GPUs available
  8,
  40,
  8,
  '["gpu_video_burst", "h265_encoding", "whisper_transcription", "remotion_rendering"]'
),
(
  'region_gcp_burst_apac',
  'gcp-asia-southeast1',
  'gcp',
  'gpu_burst_node',
  'active',
  'https://gcp-gpu-apac.sophia.agencyos.network',
  'apac',
  1.3521,
  103.8198,
  34.5,
  48.0,
  1.0,
  1,
  1000,
  32, -- 32x NVIDIA L4 GPUs available
  4,
  40,
  8,
  '["gpu_video_burst", "h265_encoding", "whisper_transcription", "remotion_rendering"]'
);

-- ============================================================================
-- 5. Seed Baseline Canonical Zero-Egress Storage Pools
-- ============================================================================
INSERT OR IGNORE INTO zero_egress_storage_pools (
  id, pool_key, provider, role, bucket_name, endpoint_url, region_zone,
  is_zero_egress, total_stored_bytes, total_objects_count, sync_state,
  replication_lag_ms, latest_sha256_root, egress_rate_cents_per_gb, status, read_priority
) VALUES
(
  'pool_r2_primary_apac',
  'r2-primary-apac',
  'cloudflare_r2',
  'primary',
  'sophia-videos-apac',
  'https://pub-r2-apac.sophia.agencyos.network',
  'apac',
  1,
  1428571428571, -- ~1.43 TB active videos
  125000,
  'synced',
  0,
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  0.0,
  'active',
  1
),
(
  'pool_r2_primary_nam',
  'r2-primary-nam',
  'cloudflare_r2',
  'primary',
  'sophia-videos-nam',
  'https://pub-r2-nam.sophia.agencyos.network',
  'nam',
  1,
  2857142857142, -- ~2.85 TB active videos
  250000,
  'synced',
  0,
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  0.0,
  'active',
  1
),
(
  'pool_b2_archive_global',
  'b2-archive-global',
  'backblaze_b2',
  'archive',
  'sophia-archive-cold',
  'https://f002.backblazeb2.com/file/sophia-archive-cold',
  'global',
  1, -- Zero egress via Cloudflare Bandwidth Alliance peering
  10485760000000, -- ~10.48 TB historical master renders
  850000,
  'synced',
  420,
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  0.0,
  'active',
  2
),
(
  'pool_s3_replica_nam',
  's3-replica-nam',
  'aws_s3',
  'replica',
  'sophia-dr-replica-useast1',
  'https://sophia-dr-replica-useast1.s3.us-east-1.amazonaws.com',
  'nam',
  0, -- Standard AWS egress if accessed externally; only used for DR
  4285714285713,
  375000,
  'synced',
  1250,
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  9.0, -- 9 cents per GB standard AWS egress
  'active',
  3
);
