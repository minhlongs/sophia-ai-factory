-- Phase 01: R2 storage tracking
ALTER TABLE videos ADD COLUMN r2_key TEXT;
ALTER TABLE videos ADD COLUMN r2_size_bytes INTEGER;
CREATE INDEX IF NOT EXISTS idx_videos_r2_key ON videos(r2_key) WHERE r2_key IS NOT NULL;
