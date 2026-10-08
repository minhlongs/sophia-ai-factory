-- Migration: 0471_growth_v14_predictive_render.sql
-- Growth Triad v14: Predictive Rendering, Dynamic Kelly Allocation & Concurrency Hardening
-- Dialect: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS growth_predictive_render_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  script_id TEXT NOT NULL,
  mab_arm_id TEXT,
  deliberation_score REAL NOT NULL,
  kelly_allocation_fraction REAL NOT NULL,
  allocated_mcu INTEGER NOT NULL,
  actual_mcu_consumed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'QUEUED', -- 'QUEUED' | 'STAGE_1_RENDERING' | 'HALTED_EARLY' | 'COMPLETED' | 'FAILED'
  early_halt_probability REAL,
  halt_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_predictive_render_jobs_user_status
  ON growth_predictive_render_jobs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_predictive_render_jobs_script
  ON growth_predictive_render_jobs(script_id);

CREATE TABLE IF NOT EXISTS growth_resilience_circuit_events (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  classification TEXT NOT NULL,
  error_message TEXT,
  circuit_state TEXT NOT NULL DEFAULT 'CLOSED', -- 'CLOSED' | 'HALF_OPEN' | 'OPEN'
  consecutive_failures INTEGER NOT NULL DEFAULT 1,
  retry_after_timestamp INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_circuit_events_resource
  ON growth_resilience_circuit_events(resource_id, circuit_state);

CREATE TABLE IF NOT EXISTS growth_distributed_locks (
  lock_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_distributed_locks_expiry
  ON growth_distributed_locks(expires_at);
