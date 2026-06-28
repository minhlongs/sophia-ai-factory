CREATE TABLE IF NOT EXISTS sop_step_confidence (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  score REAL NOT NULL,
  factors_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_confidence_execution ON sop_step_confidence(execution_id, step_index);
CREATE INDEX IF NOT EXISTS idx_confidence_score ON sop_step_confidence(score);

CREATE TABLE IF NOT EXISTS escalation_requests (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by TEXT,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_escalation_status ON escalation_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_execution ON escalation_requests(execution_id);
