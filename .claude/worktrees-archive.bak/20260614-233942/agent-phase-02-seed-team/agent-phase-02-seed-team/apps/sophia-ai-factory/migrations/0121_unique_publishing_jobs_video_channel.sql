-- Migration 0121: Partial unique index on publishing_jobs(video_id, channel_id)
--
-- WHY: Cron replay or Telegram double-tap can insert two rows for the same
-- (video_id, channel_id) pair while a job is still active, causing duplicate
-- publishes. The CAS guard in the worker only serialises per jobId — it does
-- not prevent a second INSERT before any job exists.
--
-- STRATEGY: Partial unique index covering only the non-terminal statuses
-- ('scheduled', 'uploading', 'processing'). Terminal statuses ('live',
-- 'failed') are excluded so a video can be re-scheduled after a previous
-- attempt finishes.
--
-- D1/SQLite partial-index syntax (WHERE clause on CREATE INDEX) is supported
-- since SQLite 3.8.9. Cloudflare D1 runs SQLite ≥ 3.45 — safe.
--
-- Idempotent: IF NOT EXISTS guard.

CREATE UNIQUE INDEX IF NOT EXISTS idx_publishing_jobs_unique_active
  ON publishing_jobs (video_id, channel_id)
  WHERE status IN ('scheduled', 'uploading', 'processing');
