-- Migration: Add Feature-Level Metering Columns
-- Date: 2026-03-09
-- Phase: 6A - JWT Claims Enrichment + Feature-Level Metering
-- Description: Add feature_name and feature_key columns to usage_events for granular billing attribution

-- Add feature columns to usage_events table
ALTER TABLE usage_events
ADD COLUMN IF NOT EXISTS feature_name TEXT,
ADD COLUMN IF NOT EXISTS feature_key TEXT;

-- Create index for feature-based queries (analytics, billing breakdown by feature)
CREATE INDEX IF NOT EXISTS idx_usage_events_feature_key
ON usage_events(feature_key, created_at);

-- Create index for feature name searches
CREATE INDEX IF NOT EXISTS idx_usage_events_feature_name
ON usage_events(feature_name) WHERE feature_name IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN usage_events.feature_name IS 'Human-readable feature name (e.g., "Video Generation", "Text to Speech")';
COMMENT ON COLUMN usage_events.feature_key IS 'Machine-readable feature key (e.g., "heygen.createVideo", "elevenlabs.textToSpeech")';

-- Verify columns were added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_events'
    AND column_name IN ('feature_name', 'feature_key')
  ) THEN
    RAISE NOTICE 'Feature-level metering columns added successfully';
  ELSE
    RAISE EXCEPTION 'Failed to add feature columns';
  END IF;
END $$;
