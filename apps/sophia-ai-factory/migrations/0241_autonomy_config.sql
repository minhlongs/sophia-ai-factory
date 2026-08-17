-- Autonomy configuration — per-workspace and per-agent-type
CREATE TABLE IF NOT EXISTS autonomy_configs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  agent_type TEXT DEFAULT 'global',
  level INTEGER DEFAULT 1 CHECK(level >= 0 AND level <= 4),
  overrides_json TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(workspace_id, agent_type)
);

CREATE INDEX IF NOT EXISTS idx_autonomy_configs_workspace ON autonomy_configs(workspace_id);