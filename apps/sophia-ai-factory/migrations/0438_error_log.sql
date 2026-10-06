-- Migration: 0004_error_log
-- Phase 2 Observability — error_log table for structured error tracking
-- Stores scrubbed (PII-free) error data; raw stacks NEVER stored.
-- Retention: daily-rollup cron deletes rows older than 30 days.

CREATE TABLE IF NOT EXISTS error_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT    NOT NULL,           -- ISO-8601 UTC timestamp
  level     TEXT    NOT NULL,           -- 'error' | 'fatal'
  msg       TEXT    NOT NULL,           -- normalized, PII-scrubbed message (≤500 chars)
  msg_class TEXT    NOT NULL,           -- error constructor name (e.g. 'TypeError')
  fingerprint TEXT  NOT NULL,           -- sha256(normalizedMsg + ':' + msgClass)
  ctx_json  TEXT    NOT NULL DEFAULT '{}', -- scrubbed context JSON
  commit_sha TEXT   NOT NULL DEFAULT 'unknown', -- COMMIT_SHA from env (P1) — `commit` is reserved keyword
  route     TEXT    NOT NULL DEFAULT '', -- originating API route
  status    INTEGER NOT NULL DEFAULT 500 -- HTTP status at time of error
);

CREATE INDEX IF NOT EXISTS idx_error_log_ts          ON error_log(ts);
CREATE INDEX IF NOT EXISTS idx_error_log_fingerprint ON error_log(fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_log_level       ON error_log(level);
