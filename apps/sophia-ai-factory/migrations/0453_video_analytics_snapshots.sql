-- Migration: 0453_video_analytics_snapshots.sql
-- Autonomous Video Analytics Snapshots & Cross-Platform Performance Indices

CREATE TABLE IF NOT EXISTS video_analytics_snapshots (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_post_id TEXT NOT NULL,
  title TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  watch_time_seconds REAL NOT NULL DEFAULT 0.0,
  avg_view_duration_seconds REAL NOT NULL DEFAULT 0.0,
  avg_view_percentage REAL NOT NULL DEFAULT 0.0,
  three_sec_view_rate REAL NOT NULL DEFAULT 0.0,
  completion_rate REAL NOT NULL DEFAULT 0.0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  hook_score REAL NOT NULL DEFAULT 0.0,
  retention_score REAL NOT NULL DEFAULT 0.0,
  revenue_usd REAL NOT NULL DEFAULT 0.0,
  cost_mcu INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0.0,
  net_roi_usd REAL NOT NULL DEFAULT 0.0,
  bandit_status TEXT DEFAULT 'COLD_START',
  recorded_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vas_job_recorded ON video_analytics_snapshots(job_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vas_channel_platform ON video_analytics_snapshots(channel_id, platform, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vas_user_recorded ON video_analytics_snapshots(user_id, recorded_at DESC);
