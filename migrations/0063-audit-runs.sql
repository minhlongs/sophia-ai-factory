-- Migration 0063: Zero-GAP Audit Runs
-- Stores audit run history for the admin Zero-GAP audit system.

CREATE TABLE IF NOT EXISTS audit_runs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  triggered_by_user_id TEXT NOT NULL,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  total_score INTEGER,
  total_checks INTEGER,
  passed INTEGER,
  warned INTEGER,
  failed INTEGER,
  results TEXT  -- JSON array of CheckResult[]
);

CREATE INDEX IF NOT EXISTS audit_runs_user_idx
  ON audit_runs(triggered_by_user_id, started_at);

CREATE INDEX IF NOT EXISTS audit_runs_started_idx
  ON audit_runs(started_at DESC);
