-- Migration: Add audio_url to campaigns table for TTS integration
-- Created: 2026-02-05

-- Step 1: Add audio_url column to campaigns table
ALTER TABLE campaigns
ADD COLUMN audio_url TEXT;

-- Step 2: Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_audio_url ON campaigns(audio_url) WHERE audio_url IS NOT NULL;

-- Step 3: Add comment
COMMENT ON COLUMN campaigns.audio_url IS 'URL to generated voiceover audio file (TTS output)';
