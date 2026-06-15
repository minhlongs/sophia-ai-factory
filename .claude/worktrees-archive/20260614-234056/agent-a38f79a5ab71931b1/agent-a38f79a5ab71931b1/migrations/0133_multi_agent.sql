CREATE TABLE IF NOT EXISTS agent_execution_sessions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  supervisor_agent TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'pending',
  worker_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  config_json TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_session_execution ON agent_execution_sessions(execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_session_status ON agent_execution_sessions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_task_assignments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_json TEXT,
  output_json TEXT,
  error_message TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES agent_execution_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_agent_task_session ON agent_task_assignments(session_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_task_role ON agent_task_assignments(agent_role, status);
