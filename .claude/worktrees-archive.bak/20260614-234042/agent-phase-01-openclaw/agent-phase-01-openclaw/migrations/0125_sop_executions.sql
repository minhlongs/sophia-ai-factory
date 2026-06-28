CREATE TABLE IF NOT EXISTS sop_executions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  sop_template_id TEXT NOT NULL,
  installation_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'paused', 'completed', 'failed')),
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error_message TEXT,
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,
  step_results TEXT DEFAULT '[]',
  credits_used INTEGER DEFAULT 0,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sop_exec_user ON sop_executions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sop_exec_template ON sop_executions(sop_template_id, started_at DESC);
