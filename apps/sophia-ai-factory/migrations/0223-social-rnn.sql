-- Phase 4: Social RNN Channel UI
-- Adds engagement_metrics (populated by Phase 3 collector), social_channels,
-- and publish_events for the history/metrics pages.

-- Engagement metrics: per-channel per-hour aggregates
-- Populated by the engagement collector / normalizer (Phase 3).
CREATE TABLE IF NOT EXISTS engagement_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK(channel IN ('youtube','tiktok','instagram','facebook','telegram')),
  hour_of_day INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL DEFAULT 0,
  avg_engagement REAL DEFAULT 0.0,
  total_posts INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_shares INTEGER DEFAULT 0,
  first_seen_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_metrics_channel_hour
  ON engagement_metrics (channel, hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_channel
  ON engagement_metrics (channel);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_updated
  ON engagement_metrics (updated_at);

-- Social channels: record of OAuth-connected channels per user
CREATE TABLE IF NOT EXISTS social_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('youtube','tiktok','instagram','facebook','telegram')),
  external_account_id TEXT,
  display_name TEXT,
  profile_image_url TEXT,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disconnected','expired','error')),
  followers_count INTEGER DEFAULT 0,
  last_published_at INTEGER,
  last_sync_at INTEGER,
  metadata_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_channels_user_provider
  ON social_channels (user_id, provider);
CREATE INDEX IF NOT EXISTS idx_social_channels_user
  ON social_channels (user_id);

-- Publish events: log of every publish/schedule attempt
CREATE TABLE IF NOT EXISTS publish_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  channel_id INTEGER,
  content_title TEXT,
  content_hash TEXT,
  scheduled_at INTEGER,
  published_at INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','published','failed','cancelled')),
  external_post_id TEXT,
  error_message TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_publish_events_user
  ON publish_events (user_id);
CREATE INDEX IF NOT EXISTS idx_publish_events_provider
  ON publish_events (provider);
CREATE INDEX IF NOT EXISTS idx_publish_events_status
  ON publish_events (status);
CREATE INDEX IF NOT EXISTS idx_publish_events_scheduled
  ON publish_events (scheduled_at);
