-- Sophia AI Factory D1 Migration 0007
-- Supervisor Agent: workflows table
-- Reuses missions.parent_mission_id (existing column) as FK to workflows.id

CREATE TABLE IF NOT EXISTS workflows (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id       TEXT NOT NULL REFERENCES organizations(id),
  prompt       TEXT NOT NULL,
  status       TEXT DEFAULT 'queued'
               CHECK (status IN ('queued','running','completed','failed')),
  final_result TEXT,
  error_message TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- Composite index for dashboard list query (org_id + status filter)
CREATE INDEX IF NOT EXISTS idx_workflows_org_status
  ON workflows(org_id, status);

-- Index for stepper: find all step missions for a workflow
CREATE INDEX IF NOT EXISTS idx_missions_parent
  ON missions(parent_mission_id);
