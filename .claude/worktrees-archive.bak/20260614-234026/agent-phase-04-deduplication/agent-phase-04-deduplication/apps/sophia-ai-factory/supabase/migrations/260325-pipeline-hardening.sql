-- Pipeline Hardening Migration
-- Adds retry tracking columns to campaign_checkpoints
-- and permanent storage URL to campaigns

-- campaign_checkpoints: tracking for retry count, last error, and start time
ALTER TABLE campaign_checkpoints ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE campaign_checkpoints ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE campaign_checkpoints ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- campaigns: permanent video storage URL (Supabase Storage, survives HeyGen URL expiry)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS permanent_video_url TEXT;

-- Note: 'video_timeout' is a valid status value for the campaigns.status column.
-- The status column is TEXT-compatible (enum was cast accordingly in application layer).
-- Document new status values:
--   video_timeout — HeyGen polling exceeded 10-minute limit; user notified via Telegram
--   failed        — Permanent failure; error logged; user notified
