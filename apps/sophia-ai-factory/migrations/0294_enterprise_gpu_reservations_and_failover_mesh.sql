-- Migration 0294: Enterprise GPU Reservations, Multi-Region Failover Mesh & Automated SLA Refund Monitor
-- Milestone: Enterprise Sales Pipeline & Global Distribution Mesh Engine ($200k MRR)

-- ============================================================================
-- 1. ENTERPRISE GPU RESERVATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise_gpu_reservations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id TEXT, -- References enterprise_deals(id)
  contract_id TEXT, -- References enterprise_contracts(id)
  lane_id TEXT NOT NULL UNIQUE, -- e.g. 'lane_dedicated_ent_01'
  primary_region TEXT NOT NULL DEFAULT 'apac' CHECK (primary_region IN ('apac', 'us', 'eu')),
  fallback_regions TEXT NOT NULL DEFAULT '["us", "eu"]', -- Priority fallback list
  reserved_units INTEGER NOT NULL DEFAULT 5, -- Dedicated concurrent GPU workers
  concurrency_limit INTEGER NOT NULL DEFAULT 20, -- Max concurrent active jobs
  mcu_monthly_allocation INTEGER NOT NULL DEFAULT 100000, -- 50K - 500K MCU/month
  mcu_consumed INTEGER NOT NULL DEFAULT 0,
  priority_score INTEGER NOT NULL DEFAULT 300, -- Dedicated Enterprise lane priority
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('provisioning', 'active', 'degraded', 'suspended', 'terminated')),
  sla_uptime_target REAL NOT NULL DEFAULT 0.999, -- 99.9% uptime SLA
  sla_p95_latency_ms INTEGER NOT NULL DEFAULT 1500, -- 1500ms p95 latency ceiling
  sla_degradation_window_secs INTEGER NOT NULL DEFAULT 900, -- 15-minute rolling evaluation window
  sla_refund_pct REAL NOT NULL DEFAULT 10.0, -- Default credit % per degradation incident
  allocated_providers TEXT NOT NULL DEFAULT '["fal", "runpod", "mekong"]', -- Multi-provider backend
  active_from INTEGER NOT NULL DEFAULT (unixepoch()),
  active_until INTEGER NOT NULL, -- Expiration unix epoch
  metadata TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_egr_org ON enterprise_gpu_reservations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_egr_lane ON enterprise_gpu_reservations(lane_id);
CREATE INDEX IF NOT EXISTS idx_egr_region ON enterprise_gpu_reservations(primary_region, status);
CREATE INDEX IF NOT EXISTS idx_egr_active_until ON enterprise_gpu_reservations(active_until);

-- ============================================================================
-- 2. SLA DEGRADATION INCIDENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sla_degradation_incidents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  reservation_id TEXT NOT NULL REFERENCES enterprise_gpu_reservations(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  breach_type TEXT NOT NULL CHECK (breach_type IN ('uptime', 'latency_p95', 'capacity_starvation', 'cascading_failover')),
  region TEXT NOT NULL CHECK (region IN ('apac', 'us', 'eu')),
  target_threshold REAL NOT NULL,
  measured_value REAL NOT NULL,
  started_at INTEGER NOT NULL,
  resolved_at INTEGER,
  duration_seconds INTEGER,
  impacted_jobs_count INTEGER NOT NULL DEFAULT 0,
  credit_amount_cents INTEGER NOT NULL DEFAULT 0,
  compensation_rail TEXT NOT NULL DEFAULT 'MCU_CREDIT' CHECK (compensation_rail IN ('MCU_CREDIT', 'USDT_REFUND', 'INVOICE_CREDIT')),
  refund_status TEXT NOT NULL DEFAULT 'pending' CHECK (refund_status IN ('pending', 'approved', 'disbursed', 'rejected')),
  refund_ledger_id TEXT REFERENCES refund_ledger(id),
  detected_by TEXT NOT NULL DEFAULT 'cron_sla_monitor',
  resolution_notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sdi_reservation ON sla_degradation_incidents(reservation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sdi_org ON sla_degradation_incidents(org_id, refund_status);
CREATE INDEX IF NOT EXISTS idx_sdi_breach_type ON sla_degradation_incidents(breach_type);

-- ============================================================================
-- 3. GPU MESH REGION TELEMETRY & HEALTH TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS gpu_mesh_region_health (
  region TEXT PRIMARY KEY CHECK (region IN ('apac', 'us', 'eu')),
  health_status TEXT NOT NULL DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy')),
  p95_latency_ms INTEGER NOT NULL DEFAULT 200,
  error_rate_pct REAL NOT NULL DEFAULT 0.0,
  active_reservations INTEGER NOT NULL DEFAULT 0,
  available_capacity_pct REAL NOT NULL DEFAULT 100.0,
  circuit_breaker_state TEXT NOT NULL DEFAULT 'CLOSED' CHECK (circuit_breaker_state IN ('CLOSED', 'HALF_OPEN', 'OPEN')),
  last_probe_at INTEGER NOT NULL DEFAULT (unixepoch()),
  probe_details TEXT DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Seed initial healthy regions
INSERT OR IGNORE INTO gpu_mesh_region_health (region, health_status, p95_latency_ms, error_rate_pct, circuit_breaker_state, updated_at)
VALUES 
  ('apac', 'healthy', 220, 0.0, 'CLOSED', unixepoch()),
  ('us', 'healthy', 180, 0.0, 'CLOSED', unixepoch()),
  ('eu', 'healthy', 210, 0.0, 'CLOSED', unixepoch());

-- ============================================================================
-- 4. EXTEND VIDEO_RENDER_JOBS FOR DEDICATED RESERVATION & REGIONAL FAILOVER
-- ============================================================================
ALTER TABLE video_render_jobs ADD COLUMN reservation_id TEXT REFERENCES enterprise_gpu_reservations(id);
ALTER TABLE video_render_jobs ADD COLUMN target_region TEXT DEFAULT 'apac';
ALTER TABLE video_render_jobs ADD COLUMN executed_region TEXT;
ALTER TABLE video_render_jobs ADD COLUMN failover_hops INTEGER DEFAULT 0;
ALTER TABLE video_render_jobs ADD COLUMN execution_latency_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_vrj_reservation ON video_render_jobs(reservation_id, status);
CREATE INDEX IF NOT EXISTS idx_vrj_target_region ON video_render_jobs(target_region, status);
