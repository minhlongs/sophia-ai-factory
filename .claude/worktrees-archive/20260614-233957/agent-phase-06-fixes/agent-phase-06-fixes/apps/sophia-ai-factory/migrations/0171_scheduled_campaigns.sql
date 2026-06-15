-- 0171_scheduled_campaigns.sql
-- Recurring campaign schedules used by /api/schedule and /api/cron/scheduled-campaigns.

CREATE TABLE IF NOT EXISTS scheduled_campaigns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  topic TEXT NOT NULL,
  template_script TEXT,
  interval_days INTEGER NOT NULL DEFAULT 7 CHECK (interval_days >= 1 AND interval_days <= 365),
  next_run_date TEXT NOT NULL,
  last_run_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scheduled_campaigns_user_next_run
  ON scheduled_campaigns(user_id, next_run_date);

CREATE INDEX IF NOT EXISTS idx_scheduled_campaigns_due
  ON scheduled_campaigns(is_active, next_run_date);
