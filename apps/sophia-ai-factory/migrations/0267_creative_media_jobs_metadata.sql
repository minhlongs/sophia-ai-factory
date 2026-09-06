-- Migration 0267: Creative Cell V1 — media_jobs metadata columns
--
-- Creative Cell V1 stores CreativeAsset metadata (mission/job id, provider,
-- mime, size, prompt hash, generation timestamp, JSON metadata) on the
-- EXISTING media_jobs table. No new table is created — this reuses the
-- existing asset storage per the architecture constraint.
--
-- All columns nullable: existing MuAPI rows (image/video/audio) have no
-- creative metadata and must continue to work unchanged.

ALTER TABLE media_jobs ADD COLUMN mission_id    TEXT;
ALTER TABLE media_jobs ADD COLUMN provider      TEXT;
ALTER TABLE media_jobs ADD COLUMN mime          TEXT;
ALTER TABLE media_jobs ADD COLUMN size          INTEGER;
ALTER TABLE media_jobs ADD COLUMN prompt_hash   TEXT;
ALTER TABLE media_jobs ADD COLUMN generated_at  TEXT;
ALTER TABLE media_jobs ADD COLUMN metadata      TEXT;

CREATE INDEX IF NOT EXISTS idx_media_jobs_mission_id ON media_jobs(mission_id);
CREATE INDEX IF NOT EXISTS idx_media_jobs_provider ON media_jobs(provider);