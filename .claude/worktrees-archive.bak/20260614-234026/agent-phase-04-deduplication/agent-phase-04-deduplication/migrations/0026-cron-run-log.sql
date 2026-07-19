-- Migration 0026: Cron run log table
-- Tracks cron job execution for observability, idempotency, and health checks.

CREATE TABLE IF NOT EXISTS cron_run_log (
  cron_name TEXT PRIMARY KEY,
  last_run_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_status TEXT NOT NULL DEFAULT 'unknown',
  last_error TEXT,
  run_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cron_run_log_name_run_at ON cron_run_log(cron_name, last_run_at);
