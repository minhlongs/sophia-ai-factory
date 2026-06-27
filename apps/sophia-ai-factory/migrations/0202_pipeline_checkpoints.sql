-- Pipeline checkpoint system (OpenMontage port for Inngest + D1)
-- Tenant-scoped pipeline state persistence with append-only decision log
-- Migration: 0202

-- Checkpoints table: one row per (pipeline_id, stage) per tenant
CREATE TABLE IF NOT EXISTS pipeline_checkpoints (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  pipeline_id TEXT NOT NULL,
  pipeline_type TEXT NOT NULL DEFAULT 'video_generation',
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  artifacts_json TEXT DEFAULT '{}',
  decision_log_ref TEXT,
  error TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, pipeline_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_checkpoints_tenant_pipeline
  ON pipeline_checkpoints(tenant_id, pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_checkpoints_status
  ON pipeline_checkpoints(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_checkpoints_updated
  ON pipeline_checkpoints(updated_at);

-- Decision log table: append-only audit trail per (tenant, pipeline)
CREATE TABLE IF NOT EXISTS pipeline_decision_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  pipeline_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  stage TEXT NOT NULL,
  payload_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decision_logs_tenant_pipeline
  ON pipeline_decision_logs(tenant_id, pipeline_id);
CREATE INDEX IF NOT EXISTS idx_decision_logs_decision_id
  ON pipeline_decision_logs(decision_id);
