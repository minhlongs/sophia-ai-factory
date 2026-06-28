-- Migration 0113: videos.completed_at for honest P27 render benchmark.
--
-- The `videos` table tracks the production video pipeline (queued -> processing
-- -> completed | failed | failed_permanent). The existing `updated_at` column
-- is TEXT (datetime string) and bumped at every intermediate write (webhook
-- progress, r2 mirror, etc.), so terminal `updated_at - created_at` is unreliable.
--
-- A dedicated `completed_at` INTEGER column set ONCE when status transitions
-- to 'completed' gives the benchmark a stable signal.
--
-- Backfill semantics: for pre-existing rows where status='completed', copy
-- `last_attempt_at` (already a unix epoch INTEGER) into `completed_at` so
-- historical p50/p95 still works. Rows where last_attempt_at is NULL stay NULL
-- (excluded from benchmark sample with low_confidence flag).
--
-- One-shot migration. Re-runs error with "duplicate column name" — expected.
-- Apply via apply-migrations.sh exactly once.

ALTER TABLE videos ADD COLUMN completed_at INTEGER;

UPDATE videos
SET completed_at = last_attempt_at
WHERE status = 'completed'
  AND completed_at IS NULL
  AND last_attempt_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_videos_completed_at
  ON videos(completed_at)
  WHERE completed_at IS NOT NULL;
