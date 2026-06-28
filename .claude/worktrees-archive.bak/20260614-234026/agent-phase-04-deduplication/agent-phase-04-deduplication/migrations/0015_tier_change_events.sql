-- Migration 0015: Tier change events for churn and downgrade tracking
-- Additive only — no modifications to existing tables

CREATE TABLE IF NOT EXISTS tier_change_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  org_id TEXT,
  from_tier TEXT,
  to_tier TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('upgrade', 'downgrade', 'cancel', 'activate')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_tce_user_id ON tier_change_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tce_created_at ON tier_change_events(created_at);
CREATE INDEX IF NOT EXISTS idx_tce_event_type ON tier_change_events(event_type);
