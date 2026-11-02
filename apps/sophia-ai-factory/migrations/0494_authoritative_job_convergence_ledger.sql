-- Migration 0494: Authoritative Job Convergence Ledger
-- Unifies Creative Mission (5-station) and OPC Affiliate Video Execution flows
-- under a single authoritative D1 table with 4 independent outcome axes,
-- CAS version transitions, lease-token recovery, crash quarantine paths, and unit economics.

CREATE TABLE IF NOT EXISTS authoritative_job_convergence_ledger (
  job_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  mission_id TEXT,
  execution_run_id TEXT,
  mekong_job_id TEXT,
  idempotency_key TEXT NOT NULL,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  lease_token TEXT,
  lease_expires_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  lifecycle_stage TEXT NOT NULL DEFAULT 'creative_mission_intake',
  execution_outcome TEXT NOT NULL DEFAULT 'pending',
  verification_outcome TEXT NOT NULL DEFAULT 'pending',
  delivery_outcome TEXT NOT NULL DEFAULT 'pending',
  business_outcome TEXT NOT NULL DEFAULT 'pending',
  execution_mode TEXT NOT NULL DEFAULT 'LOCAL_DETERMINISTIC',
  side_effect_uncertain INTEGER NOT NULL DEFAULT 0,
  crash_preserved_path TEXT,
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  actual_cost_usd REAL NOT NULL DEFAULT 0,
  retry_cost_usd REAL NOT NULL DEFAULT 0,
  artifact_manifest_json TEXT NOT NULL DEFAULT '[]',
  verification_report_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_convergence_ledger_workspace_stage ON authoritative_job_convergence_ledger(workspace_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_convergence_ledger_mission ON authoritative_job_convergence_ledger(mission_id);
CREATE INDEX IF NOT EXISTS idx_convergence_ledger_execution_run ON authoritative_job_convergence_ledger(execution_run_id);
CREATE INDEX IF NOT EXISTS idx_convergence_ledger_mekong_job ON authoritative_job_convergence_ledger(mekong_job_id);
