-- AgentRun — persistent execution record for Sophia 2027 AgentProtocol
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  started_at INTEGER,
  ended_at INTEGER,
  status TEXT NOT NULL DEFAULT 'queued',
  phase TEXT NOT NULL DEFAULT 'planning',
  input_json TEXT,
  output_json TEXT,
  error_json TEXT,
  error_message TEXT,
  autonomy_level INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  parent_run_id TEXT,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_mission ON agent_runs(mission_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace ON agent_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);

-- AgentApproval — approval gate record for human-in-the-loop
CREATE TABLE IF NOT EXISTS agent_approvals (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_summary TEXT NOT NULL,
  estimated_cost_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id TEXT,
  comment TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at INTEGER,
  timeout_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_approvals_run ON agent_approvals(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_approvals_status ON agent_approvals(status);

-- AgentRunLog — structured log entries per agent run
CREATE TABLE IF NOT EXISTS agent_run_logs (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_agent_run_logs_run ON agent_run_logs(agent_run_id);