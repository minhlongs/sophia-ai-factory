CREATE TABLE IF NOT EXISTS rollback_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  agent_run_id TEXT,
  reason TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  rolled_back_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_rollback_logs_workspace_id ON rollback_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_rollback_logs_mission_id ON rollback_logs(mission_id);
CREATE INDEX IF NOT EXISTS idx_rollback_logs_agent_run_id ON rollback_logs(agent_run_id);
