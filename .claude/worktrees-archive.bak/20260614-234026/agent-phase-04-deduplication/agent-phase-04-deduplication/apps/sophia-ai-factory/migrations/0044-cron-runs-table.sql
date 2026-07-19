-- Migration 0044: cron_runs table
-- Rich per-run tracking for scheduled cron jobs.
-- Complements cron_run_log (0026) which tracks last-run-per-cron.
-- cron_runs stores every individual execution with duration + metadata.

CREATE TABLE IF NOT EXISTS cron_runs (
  id TEXT PRIMARY KEY,
  cron_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','failed','skipped')),
  run_at INTEGER NOT NULL,  -- epoch seconds
  duration_ms INTEGER,
  message TEXT,
  metadata TEXT  -- JSON
);

CREATE INDEX IF NOT EXISTS cron_runs_name_run_at_idx ON cron_runs(cron_name, run_at);
CREATE INDEX IF NOT EXISTS cron_runs_run_at_idx ON cron_runs(run_at);
