-- Migration: batch_jobs fanout dedup -- Purpose: Add fanout_dispatched_at column to prevent duplicate fanout events
-- When set, startBatchAction will skip dispatching batch/video.fanout
ALTER TABLE batch_jobs ADD COLUMN fanout_dispatched_at TEXT;
