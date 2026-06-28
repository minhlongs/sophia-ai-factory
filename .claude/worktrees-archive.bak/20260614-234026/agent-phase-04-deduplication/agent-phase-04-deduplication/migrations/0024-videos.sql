-- Migration: 0024-videos
-- User-generated video gallery — Phase 3 of video pipeline
-- Tracks HeyGen render jobs initiated from /dashboard/videos/new

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  script_request_id TEXT,                          -- ephemeral ID from /api/scripts/generate
  heygen_job_id TEXT NOT NULL,                     -- HeyGen video_id (used for status polling)
  title TEXT,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  video_url TEXT,
  thumbnail_url TEXT,
  duration_sec INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_videos_user_created
  ON videos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_heygen_job
  ON videos(heygen_job_id);
CREATE INDEX IF NOT EXISTS idx_videos_status
  ON videos(status) WHERE status = 'processing';
