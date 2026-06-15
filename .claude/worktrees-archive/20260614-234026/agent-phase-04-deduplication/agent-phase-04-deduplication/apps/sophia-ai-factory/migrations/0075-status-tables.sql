-- Migration 0075: Status page tables — uptime checks, daily rollup, incidents

CREATE TABLE IF NOT EXISTS status_check (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  status TEXT NOT NULL,   -- 'ok' | 'degraded' | 'down'
  latency_ms INTEGER,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_status_check_ts ON status_check(ts DESC);

CREATE TABLE IF NOT EXISTS status_day_rollup (
  date TEXT PRIMARY KEY,         -- YYYY-MM-DD
  total_checks INTEGER NOT NULL DEFAULT 0,
  ok_checks INTEGER NOT NULL DEFAULT 0,
  p99_ms INTEGER
);

CREATE TABLE IF NOT EXISTS status_incident (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  severity TEXT NOT NULL DEFAULT 'minor',  -- 'minor' | 'major' | 'critical'
  title TEXT NOT NULL,
  description TEXT,
  postmortem_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_status_incident_started ON status_incident(started_at DESC);
