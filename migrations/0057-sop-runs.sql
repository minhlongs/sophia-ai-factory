-- SOP Run History
-- Tracks every execution: queued → running → succeeded|failed|partial

CREATE TABLE IF NOT EXISTS sop_runs (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cron','webhook','manual')),
  mission_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array of engine_missions.id
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','partial')),
  result_summary TEXT,    -- JSON aggregate of step outputs
  error_message TEXT,
  requires_approval INTEGER NOT NULL DEFAULT 0,  -- 1 = paused, waiting for human gate
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (installation_id) REFERENCES user_sop_installations(id)
);

CREATE INDEX IF NOT EXISTS idx_sop_runs_inst ON sop_runs(installation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sop_runs_status ON sop_runs(status, started_at);
