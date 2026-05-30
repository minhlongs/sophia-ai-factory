-- Migration 0101: publishing pipeline tables with `video_id` column (Wave 20 Phase 05).
--
-- WHY THIS LOOKS LIKE A "CREATE" RATHER THAN A "RENAME":
-- The seed migration `src/seed/db/migrations/20260503_publishing.sql` was never
-- applied to remote D1 (only `publishing_channels` got promoted earlier).
-- A pure ALTER TABLE … RENAME COLUMN against a non-existent table fails
-- ("no such table: publishing_jobs"), so this migration BOTH creates the
-- canonical schema AND uses the renamed `video_id` column directly.
--
-- The legacy column name `video_job_id` was misleading — it actually stored
-- `videos.id` (post Wave 16 Phase 02). Code/tests/types now use `video_id`.
-- engine_missions.video_job_id is intentionally left untouched (different
-- semantic — that one stores the external Wan video-job ID).
--
-- Idempotent: every statement uses IF NOT EXISTS. Safe to re-run.

CREATE TABLE IF NOT EXISTS publishing_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('scheduled','uploading','processing','live','failed')),
  caption TEXT,
  hashtags_json TEXT,
  product_link TEXT,
  scheduled_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS publishing_results (
  id TEXT PRIMARY KEY,
  publishing_job_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  channel_post_id TEXT,
  post_url TEXT,
  metrics_json TEXT,
  published_at INTEGER NOT NULL,
  FOREIGN KEY (publishing_job_id) REFERENCES publishing_jobs(id)
);

CREATE TABLE IF NOT EXISTS channel_quotas (
  channel_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  day TEXT NOT NULL,
  daily_limit INTEGER NOT NULL,
  used_today INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, day)
);

CREATE INDEX IF NOT EXISTS idx_pub_jobs_status_sched ON publishing_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_pub_jobs_tenant ON publishing_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pub_results_job ON publishing_results(publishing_job_id);
CREATE INDEX IF NOT EXISTS idx_channel_quotas_day ON channel_quotas(day);
