-- Migration 0311: Edge GPU Video Mesh, Dynamic Workload Balancer & 6-Nines SLA Escrow
-- Milestone: GATE 10: $5,000,000 MRR ($60M ARR, 20,000 Customers, $250 ARPU, 99.9999% SLA)
-- Standards: Cloudflare D1 SQLite, millisecond Unix timestamps, strict CHECK constraints, random hex UUIDs.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. gpu_compute_nodes
-- Global inventory of edge GPU rendering nodes (H100, A100, L40S, RTX4090).
-- ============================================================================
CREATE TABLE IF NOT EXISTS gpu_compute_nodes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  node_id TEXT UNIQUE NOT NULL, -- e.g. 'gpu-tokyo-h100-01', 'gpu-iad-a100-04'
  region TEXT NOT NULL CHECK(region IN (
    'apac-tokyo', 'apac-singapore', 'apac-vietnam',
    'us-east-iad', 'us-west-sfo', 'eu-west-fra', 'eu-central-ams'
  )),
  provider TEXT NOT NULL DEFAULT 'cloud' CHECK(provider IN ('cloud', 'bare_metal', 'edge_mesh', 'hybrid')),
  gpu_model TEXT NOT NULL CHECK(gpu_model IN ('H100', 'A100', 'L40S', 'RTX4090')),
  gpu_count INTEGER NOT NULL DEFAULT 8 CHECK(gpu_count > 0),
  vram_gb_per_gpu INTEGER NOT NULL DEFAULT 80 CHECK(vram_gb_per_gpu > 0),
  total_vram_gb INTEGER NOT NULL DEFAULT 640 CHECK(total_vram_gb > 0),
  status TEXT NOT NULL DEFAULT 'online' CHECK(status IN ('online', 'busy', 'degraded', 'draining', 'offline')),
  current_load_pct REAL NOT NULL DEFAULT 0.0 CHECK(current_load_pct >= 0.0 AND current_load_pct <= 100.0),
  active_render_jobs INTEGER NOT NULL DEFAULT 0 CHECK(active_render_jobs >= 0),
  max_concurrency INTEGER NOT NULL DEFAULT 32 CHECK(max_concurrency > 0),
  p95_latency_ms REAL NOT NULL DEFAULT 12.0 CHECK(p95_latency_ms >= 0.0),
  p99_latency_ms REAL NOT NULL DEFAULT 18.0 CHECK(p99_latency_ms >= 0.0),
  spot_price_cents_per_hour INTEGER NOT NULL DEFAULT 250 CHECK(spot_price_cents_per_hour > 0), -- $2.50/hr
  on_demand_price_cents_per_hour INTEGER NOT NULL DEFAULT 400 CHECK(on_demand_price_cents_per_hour >= spot_price_cents_per_hour), -- $4.00/hr
  supported_codecs_json TEXT NOT NULL DEFAULT '["h264","hevc","av1","prores"]',
  max_resolution TEXT NOT NULL DEFAULT '4K' CHECK(max_resolution IN ('1080p', '4K', '8K')),
  health_score REAL NOT NULL DEFAULT 1.0 CHECK(health_score >= 0.0 AND health_score <= 1.0),
  is_healthy INTEGER NOT NULL DEFAULT 1 CHECK(is_healthy IN (0, 1)),
  total_renders_completed INTEGER NOT NULL DEFAULT 0 CHECK(total_renders_completed >= 0),
  total_render_seconds REAL NOT NULL DEFAULT 0.0 CHECK(total_render_seconds >= 0.0),
  last_heartbeat_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_gcn_region_status ON gpu_compute_nodes(region, status, is_healthy);
CREATE INDEX IF NOT EXISTS idx_gcn_model_load ON gpu_compute_nodes(gpu_model, current_load_pct, health_score);
CREATE INDEX IF NOT EXISTS idx_gcn_spot_price ON gpu_compute_nodes(spot_price_cents_per_hour, p95_latency_ms);
CREATE INDEX IF NOT EXISTS idx_gcn_heartbeat ON gpu_compute_nodes(last_heartbeat_at);

-- ============================================================================
-- 2. video_render_dispatches
-- Telemetry log of AI video render tasks (enforces 4K render < 15s).
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_render_dispatches (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  dispatch_id TEXT UNIQUE NOT NULL,
  tenant_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  node_id TEXT NOT NULL REFERENCES gpu_compute_nodes(node_id),
  video_resolution TEXT NOT NULL CHECK(video_resolution IN ('720p', '1080p', '4K', '8K')),
  video_duration_seconds REAL NOT NULL CHECK(video_duration_seconds > 0.0),
  frame_count INTEGER NOT NULL CHECK(frame_count > 0),
  codec TEXT NOT NULL DEFAULT 'h264' CHECK(codec IN ('h264', 'hevc', 'av1', 'prores')),
  status TEXT NOT NULL DEFAULT 'dispatched' CHECK(status IN ('pending', 'dispatched', 'rendering', 'completed', 'failed', 'rerouted')),
  priority_score INTEGER NOT NULL DEFAULT 100 CHECK(priority_score >= 0),
  spot_pricing_applied INTEGER NOT NULL DEFAULT 1 CHECK(spot_pricing_applied IN (0, 1)),
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK(cost_cents >= 0),
  queue_wait_ms INTEGER NOT NULL DEFAULT 0 CHECK(queue_wait_ms >= 0),
  render_duration_ms INTEGER CHECK(render_duration_ms IS NULL OR render_duration_ms >= 0),
  egress_bytes INTEGER NOT NULL DEFAULT 0 CHECK(egress_bytes >= 0),
  sla_target_ms INTEGER NOT NULL DEFAULT 15000 CHECK(sla_target_ms > 0), -- 15,000ms = 15s target for 4K
  sla_breached INTEGER NOT NULL DEFAULT 0 CHECK(sla_breached IN (0, 1)),
  reroute_count INTEGER NOT NULL DEFAULT 0 CHECK(reroute_count >= 0),
  failover_history_json TEXT NOT NULL DEFAULT '[]',
  error_message TEXT,
  dispatched_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_vrd_tenant_dispatched ON video_render_dispatches(tenant_id, dispatched_at DESC);
CREATE INDEX IF NOT EXISTS idx_vrd_node_status ON video_render_dispatches(node_id, status);
CREATE INDEX IF NOT EXISTS idx_vrd_sla_breach ON video_render_dispatches(sla_breached, video_resolution);
CREATE INDEX IF NOT EXISTS idx_vrd_job_id ON video_render_dispatches(job_id);

-- ============================================================================
-- 3. sla_penalty_escrow
-- Six-Nines (99.9999%) SLA guarantee fund and automated penalty escrow ledger.
-- ============================================================================
CREATE TABLE IF NOT EXISTS sla_penalty_escrow (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  escrow_id TEXT UNIQUE NOT NULL,
  tenant_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  period_month TEXT NOT NULL, -- Format: 'YYYY-MM'
  target_sla_pct REAL NOT NULL DEFAULT 99.9999, -- Six Nines (99.9999%)
  actual_uptime_pct REAL NOT NULL DEFAULT 100.0,
  total_period_seconds INTEGER NOT NULL DEFAULT 2592000, -- 30 days * 86,400s
  allowed_downtime_seconds REAL NOT NULL DEFAULT 2.592, -- 2,592,000 * 0.000001 = 2.592s
  downtime_seconds REAL NOT NULL DEFAULT 0.0 CHECK(downtime_seconds >= 0.0),
  error_budget_consumed_seconds REAL NOT NULL DEFAULT 0.0 CHECK(error_budget_consumed_seconds >= 0.0),
  error_budget_remaining_seconds REAL NOT NULL DEFAULT 2.592,
  escrow_funded_cents INTEGER NOT NULL DEFAULT 0 CHECK(escrow_funded_cents >= 0),
  penalty_claimed_cents INTEGER NOT NULL DEFAULT 0 CHECK(penalty_claimed_cents >= 0),
  escrow_balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(escrow_balance_cents >= 0),
  breach_tier TEXT NOT NULL DEFAULT 'none' CHECK(breach_tier IN ('none', 'minor', 'moderate', 'major', 'catastrophic')),
  penalty_pct REAL NOT NULL DEFAULT 0.0 CHECK(penalty_pct >= 0.0 AND penalty_pct <= 100.0),
  escrow_status TEXT NOT NULL DEFAULT 'locked' CHECK(escrow_status IN ('locked', 'partially_disbursed', 'fully_disbursed', 'released_to_revenue')),
  last_breach_timestamp INTEGER,
  audit_hash TEXT NOT NULL, -- Cryptographic HMAC-SHA256 of the escrow state
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(tenant_id, contract_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_spe_tenant_period ON sla_penalty_escrow(tenant_id, period_month);
CREATE INDEX IF NOT EXISTS idx_spe_status_breach ON sla_penalty_escrow(escrow_status, breach_tier);
