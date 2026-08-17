-- ProvenanceRecord — Sophia 2027 Creative Economy OS
-- Append-only audit trail for all generated/derived content.
-- Layer: tree (domain-specific reusable)

CREATE TABLE IF NOT EXISTS provenance_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  agent_run_id TEXT,
  action TEXT NOT NULL, -- 'created'|'generated'|'edited'|'approved'|'rejected'|'published'|'derived'|'archived'
  actor_type TEXT NOT NULL, -- 'human'|'agent'|'system'
  actor_id TEXT NOT NULL,
  model TEXT,
  model_version TEXT,
  prompt TEXT,
  source_asset_id TEXT,
  human_edits TEXT,
  approval_id TEXT,
  derivative_of TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provenance_asset ON provenance_records (asset_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_provenance_workspace ON provenance_records (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provenance_derivative ON provenance_records (derivative_of);