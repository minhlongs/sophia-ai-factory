-- Migration 0113: video_jobs.completed_at for honest P27 render benchmark.
--
-- The existing `updated_at` column is bumped at every intermediate stage
-- (scripting, tts, visual, compose) so terminal `updated_at - created_at`
-- conflates render duration with backfill / audit writes. A dedicated
-- `completed_at` column set ONCE at terminal status transition gives the
-- benchmark a stable signal.
--
-- Backfill semantics: for pre-existing rows where status IN ('uploaded','published'),
-- copy `updated_at` into `completed_at` so historical p50/p95 still works
-- (with `low_confidence` flag honestly noting the mixed-source data).
--
-- One-shot migration. Re-runs error with "duplicate column name" — expected.
-- Apply via apply-migrations.sh exactly once.

ALTER TABLE video_jobs ADD COLUMN completed_at INTEGER;

UPDATE video_jobs
SET completed_at = updated_at
WHERE status IN ('uploaded', 'published')
  AND completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_video_jobs_completed_at
  ON video_jobs(completed_at)
  WHERE completed_at IS NOT NULL;
