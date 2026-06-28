-- Migration 0040: Extend videos table for fulfillment retry state machine
-- Adds queued/failed_permanent statuses + retry bookkeeping fields.
-- New valid status values: 'queued', 'processing', 'completed', 'failed', 'failed_permanent'

ALTER TABLE videos ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN last_attempt_at INTEGER;
ALTER TABLE videos ADD COLUMN last_error TEXT;
ALTER TABLE videos ADD COLUMN script TEXT;
ALTER TABLE videos ADD COLUMN locale TEXT;
ALTER TABLE videos ADD COLUMN provider TEXT NOT NULL DEFAULT 'heygen';

-- Index for retry cron: find queued rows efficiently
CREATE INDEX IF NOT EXISTS idx_videos_status_queued
  ON videos(status, last_attempt_at)
  WHERE status = 'queued';

-- Index for purchase-to-video lookups (idempotency + order page join)
CREATE INDEX IF NOT EXISTS idx_videos_purchase_status
  ON videos(purchase_id, status)
  WHERE purchase_id IS NOT NULL;
