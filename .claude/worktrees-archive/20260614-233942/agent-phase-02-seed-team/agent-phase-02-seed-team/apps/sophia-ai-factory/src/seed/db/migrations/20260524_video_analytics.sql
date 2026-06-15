-- Migration 20260524: Per-video analytics table
-- Phase 05: Video Analytics for YouTube (and future platforms)

CREATE TABLE IF NOT EXISTS video_analytics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_video_id TEXT NOT NULL,
  date TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  watch_time_sec INTEGER DEFAULT 0,
  completion_rate REAL DEFAULT 0.0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(video_id, platform, date)
);

CREATE INDEX IF NOT EXISTS idx_video_analytics_user_id ON video_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_video_id ON video_analytics(video_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_date ON video_analytics(date);
