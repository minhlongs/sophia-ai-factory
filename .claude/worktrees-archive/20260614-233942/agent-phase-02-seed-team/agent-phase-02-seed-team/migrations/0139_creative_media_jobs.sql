-- Migration 0139: Creative Studio media_jobs table
-- Tracks async image/video/audio generation jobs submitted via MuAPI
-- and ElevenLabs TTS.

CREATE TABLE IF NOT EXISTS media_jobs (
  id            TEXT    PRIMARY KEY,
  user_id       TEXT    NOT NULL,
  type          TEXT    NOT NULL CHECK(type IN ('image', 'video', 'audio')),
  model         TEXT    NOT NULL,
  prompt        TEXT,
  status        TEXT    NOT NULL DEFAULT 'pending',
  result_url    TEXT,
  thumbnail_url TEXT,
  error         TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at  INTEGER
);

-- Index to efficiently list a user's jobs by type, newest first
CREATE INDEX IF NOT EXISTS idx_media_jobs_user_type
  ON media_jobs(user_id, type, created_at DESC);
