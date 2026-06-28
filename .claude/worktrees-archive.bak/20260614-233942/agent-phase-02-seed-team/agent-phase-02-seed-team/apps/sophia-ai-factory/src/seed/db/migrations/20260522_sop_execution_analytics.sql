-- SOP Execution Analytics tables
-- Tracks per-step logs and aggregate metrics for SOP executions.
-- Foundation for self-improving SOPs (quality scoring, performance trending).

CREATE TABLE IF NOT EXISTS sop_execution_logs (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  sop_template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('started','completed','failed','skipped')),
  input_hash TEXT,
  output_summary TEXT,
  duration_ms INTEGER,
  cost_cents INTEGER DEFAULT 0,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sop_execution_metrics (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL UNIQUE,
  sop_template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  total_duration_ms INTEGER NOT NULL,
  total_cost_cents INTEGER DEFAULT 0,
  steps_completed INTEGER NOT NULL DEFAULT 0,
  steps_failed INTEGER NOT NULL DEFAULT 0,
  quality_score REAL,
  user_rating INTEGER,
  feedback_text TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exec_log_execution ON sop_execution_logs(execution_id, step_index);
CREATE INDEX IF NOT EXISTS idx_exec_log_sop ON sop_execution_logs(sop_template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_log_user ON sop_execution_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_metrics_sop ON sop_execution_metrics(sop_template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_metrics_user ON sop_execution_metrics(user_id, created_at DESC);
