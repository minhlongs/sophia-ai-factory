CREATE TABLE IF NOT EXISTS sop_execution_outcomes (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  sop_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value REAL NOT NULL,
  source TEXT,
  recorded_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outcome_execution ON sop_execution_outcomes(execution_id);
CREATE INDEX IF NOT EXISTS idx_outcome_sop ON sop_execution_outcomes(sop_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_outcome_user ON sop_execution_outcomes(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcome_type ON sop_execution_outcomes(metric_type, recorded_at DESC);
