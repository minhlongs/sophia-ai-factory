-- Migration: 0034-video-onboarding-events
-- Tracks auto-generated onboarding videos for new Premium+/MASTER purchases

CREATE TABLE IF NOT EXISTS video_onboarding_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  org_id TEXT,
  payment_id TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL,
  video_id TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(delivery_status IN ('pending','generating','delivered','email_sent','failed')),
  email_recipient TEXT,
  email_sent_at INTEGER,
  delivered_at INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user ON video_onboarding_events(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_payment ON video_onboarding_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON video_onboarding_events(delivery_status);

ALTER TABLE videos ADD COLUMN is_onboarding INTEGER DEFAULT 0;
