-- Migration 0043: Relax videos table constraints for fulfillment state machine
-- (a) heygen_job_id NOT NULL → nullable (videos are enqueued before HeyGen accepts the job)
-- (b) CHECK on status updated to allow: queued, processing, completed, failed, failed_permanent
--
-- SQLite does not support ALTER COLUMN — requires table rebuild (temp-table swap).

PRAGMA foreign_keys = OFF;

-- Step 1: Create new table with relaxed constraints
CREATE TABLE videos_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  script_request_id TEXT,
  heygen_job_id TEXT,                              -- Was NOT NULL; now nullable
  title TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'failed_permanent')),
  video_url TEXT,
  thumbnail_url TEXT,
  duration_sec INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at TEXT DEFAULT (datetime('now')),
  r2_key TEXT,
  r2_size_bytes INTEGER,
  purchase_id TEXT,                                -- FK to user_purchases(id) enforced at app level
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER,
  last_error TEXT,
  script TEXT,
  locale TEXT,
  provider TEXT NOT NULL DEFAULT 'heygen',
  access_revoked INTEGER NOT NULL DEFAULT 0
);

-- Step 2: Copy all existing rows (existing status values are preserved)
INSERT INTO videos_new (
  id, user_id, script_request_id, heygen_job_id, title, status,
  video_url, thumbnail_url, duration_sec, error, created_at, updated_at,
  r2_key, r2_size_bytes, purchase_id, attempt_count, last_attempt_at,
  last_error, script, locale, provider, access_revoked
)
SELECT
  id, user_id, script_request_id, heygen_job_id, title, status,
  video_url, thumbnail_url, duration_sec, error, created_at, updated_at,
  r2_key, r2_size_bytes, purchase_id, attempt_count, last_attempt_at,
  last_error, script, locale, provider, access_revoked
FROM videos;

-- Step 3: Drop old table and rename new one
DROP TABLE videos;
ALTER TABLE videos_new RENAME TO videos;

-- Step 4: Re-create all indexes from prior migrations
CREATE INDEX IF NOT EXISTS idx_videos_user_created
  ON videos(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_videos_heygen_job
  ON videos(heygen_job_id)
  WHERE heygen_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_videos_status
  ON videos(status) WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_videos_access_revoked
  ON videos(access_revoked) WHERE access_revoked = 1;

CREATE INDEX IF NOT EXISTS idx_videos_purchase_id
  ON videos (purchase_id) WHERE purchase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_videos_status_queued
  ON videos(status, last_attempt_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_videos_purchase_status
  ON videos(purchase_id, status)
  WHERE purchase_id IS NOT NULL;

PRAGMA foreign_keys = ON;
