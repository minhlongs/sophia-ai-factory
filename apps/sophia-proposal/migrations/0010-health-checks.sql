-- Migration 0010: Health check history for uptime monitoring
-- Records periodic deep health check results from cron

CREATE TABLE IF NOT EXISTS health_checks (
  id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  status    TEXT NOT NULL,        -- 'ok' | 'degraded' | 'error'
  latency_ms INTEGER NOT NULL,    -- response time in milliseconds
  details   TEXT,                 -- JSON payload from /api/health/deep
  checked_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON health_checks (checked_at DESC);
