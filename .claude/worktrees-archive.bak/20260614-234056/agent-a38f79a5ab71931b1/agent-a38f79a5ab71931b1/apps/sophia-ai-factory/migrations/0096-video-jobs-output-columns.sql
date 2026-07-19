-- Migration 0096: Add video output columns to engine_missions
-- Idempotent: wrapped in a migration guard pattern (D1 uses SQLite 3.35+)
-- Adds output_video_url, output_audio_url, video_job_id columns used by
-- the video-generate Inngest workflow (Wave 12 G4).

-- D1 / SQLite does not support ADD COLUMN IF NOT EXISTS directly.
-- Use separate ALTER TABLE statements; D1 migrations are run sequentially
-- and this file is applied exactly once via apply-migrations.sh.

ALTER TABLE engine_missions ADD COLUMN output_video_url TEXT;
ALTER TABLE engine_missions ADD COLUMN output_audio_url TEXT;
ALTER TABLE engine_missions ADD COLUMN video_job_id TEXT;
