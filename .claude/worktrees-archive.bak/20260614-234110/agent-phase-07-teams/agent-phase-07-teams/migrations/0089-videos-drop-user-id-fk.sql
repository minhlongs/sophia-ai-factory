-- Migration 0089: Drop videos.user_id FK (last remaining users(id) FK trap)
--
-- FK audit (2026-05-05) confirmed `videos` is the LAST table on production D1
-- whose user_id REFERENCES users(id) (legacy plural). Better-auth creates users
-- in `user` (singular) — every video INSERT for new users (post-FREE100, signup)
-- would silently fail FK constraint just like 0087 (subscriptions) and 0088 (org_members).
--
-- Active INSERT path verified: src/seed/db/repositories/videos-repo.ts:59
-- (raw SQL using db.prepare with better-auth user.id)
--
-- Other tables in source migrations referencing users(id) are either:
--   - already rebuilt clean by later migrations (campaigns, affiliate_clicks)
--   - never created on remote (raas_licenses, tier_change_events, user_wallets, etc.)
-- so this is the only outstanding FK trap.

PRAGMA foreign_keys = OFF;

CREATE TABLE videos_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  script_request_id TEXT,
  heygen_job_id TEXT,
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
  purchase_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER,
  last_error TEXT,
  script TEXT,
  locale TEXT,
  provider TEXT NOT NULL DEFAULT 'heygen',
  access_revoked INTEGER NOT NULL DEFAULT 0,
  is_onboarding INTEGER NOT NULL DEFAULT 0
);

INSERT INTO videos_new (
  id, user_id, script_request_id, heygen_job_id, title, status,
  video_url, thumbnail_url, duration_sec, error, created_at, updated_at,
  r2_key, r2_size_bytes, purchase_id, attempt_count, last_attempt_at,
  last_error, script, locale, provider, access_revoked, is_onboarding
)
SELECT
  id, user_id, script_request_id, heygen_job_id, title, status,
  video_url, thumbnail_url, duration_sec, error, created_at, updated_at,
  r2_key, r2_size_bytes, purchase_id, attempt_count, last_attempt_at,
  last_error, script, locale, provider, access_revoked, is_onboarding
FROM videos;

DROP TABLE videos;
ALTER TABLE videos_new RENAME TO videos;

CREATE INDEX IF NOT EXISTS idx_videos_user_created
  ON videos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_heygen_job
  ON videos(heygen_job_id) WHERE heygen_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_status
  ON videos(status) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_videos_status_queued
  ON videos(status, last_attempt_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_videos_purchase_id
  ON videos(purchase_id) WHERE purchase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_purchase_status
  ON videos(purchase_id, status) WHERE purchase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_access_revoked
  ON videos(access_revoked) WHERE access_revoked = 1;

PRAGMA foreign_keys = ON;
