CREATE TABLE IF NOT EXISTS performance_feedback_cycles (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  sop_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  evaluate_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metrics_json TEXT,
  evaluation_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON performance_feedback_cycles(status, evaluate_at);
CREATE INDEX IF NOT EXISTS idx_feedback_sop ON performance_feedback_cycles(sop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON performance_feedback_cycles(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS prompt_optimization_log (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  sop_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  original_prompt TEXT NOT NULL,
  suggested_prompt TEXT NOT NULL,
  improvement_score REAL,
  applied INTEGER NOT NULL DEFAULT 0,
  applied_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (cycle_id) REFERENCES performance_feedback_cycles(id)
);
CREATE INDEX IF NOT EXISTS idx_optimization_cycle ON prompt_optimization_log(cycle_id);
CREATE INDEX IF NOT EXISTS idx_optimization_sop ON prompt_optimization_log(sop_id, step_index);
