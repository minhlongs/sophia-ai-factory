-- Migration 0227: campaign_videos child table + refund_badge columns
--
-- Adds per-campaign video tracking so the refund-badge hard cap can
-- derive: cap = COUNT(videos WHERE status='completed') × creditsPerVideo.
-- Also adds refund_badge_cents to campaigns for the live badge value.

-- campaigns: refund badge columns
ALTER TABLE campaigns ADD COLUMN refund_badge_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN refund_badge_updated_at TEXT;

-- campaign_videos: one row per video attempt per campaign
CREATE TABLE IF NOT EXISTS campaign_videos (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id     TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','generating','completed','failed','cancelled')),
  video_url       TEXT,
  error_message   TEXT,
  cost_cents      INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_campaign_videos_campaign_id
  ON campaign_videos(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_videos_campaign_status
  ON campaign_videos(campaign_id, status);
