-- Migration 0101: Rename publishing_jobs.video_job_id → video_id
-- Wave 20 Phase 05: column actually stores videos.id (post Wave 16 Phase 02);
-- the legacy "video_job_id" name was misleading. Single atomic SQLite rename.
-- Indexes on the column (if any) are preserved automatically.
--
-- engine_missions.video_job_id is intentionally NOT renamed — that column
-- legitimately stores the external Wan video-job ID.

ALTER TABLE publishing_jobs RENAME COLUMN video_job_id TO video_id;
