-- Migration 0268: fal.ai R2 self-hosting — storage_key + bucket columns
--
-- Adds R2 persistence metadata to media_jobs so fal-ai image rows can
-- reference their self-hosted R2 object. Nullable: existing MuAPI rows
-- (image/video/audio) have no R2 metadata and stay clean unchanged.

ALTER TABLE media_jobs ADD COLUMN storage_key TEXT;
ALTER TABLE media_jobs ADD COLUMN bucket      TEXT;

CREATE INDEX IF NOT EXISTS idx_media_jobs_storage_key ON media_jobs(storage_key) WHERE storage_key IS NOT NULL;
