-- Migration: 0111-ab-experiments
-- Purpose: A/B title + thumbnail runner — experiment tracking table
-- Schema: per-video experiment with 2 variants (A/B), impression/conversion counters,
--         winner selection, and lifecycle status.

CREATE TABLE IF NOT EXISTS ab_experiments (
  id                    TEXT PRIMARY KEY,          -- uuid or short-id
  video_id              TEXT NOT NULL,             -- references video / offer
  tenant_id             TEXT NOT NULL,             -- tenant isolation

  -- Variant content
  variant_a_caption     TEXT NOT NULL,             -- Title / caption for variant A
  variant_b_caption     TEXT NOT NULL,             -- Title / caption for variant B
  variant_a_thumb_url   TEXT,                      -- Thumbnail URL for variant A (nullable = not generated yet)
  variant_b_thumb_url   TEXT,                      -- Thumbnail URL for variant B

  -- Counters (updated by tracking cron)
  impressions_a         INTEGER NOT NULL DEFAULT 0,
  impressions_b         INTEGER NOT NULL DEFAULT 0,
  conversions_a         INTEGER NOT NULL DEFAULT 0,
  conversions_b         INTEGER NOT NULL DEFAULT 0,

  -- Winner state: NULL = pending, 'a' = variant A won, 'b' = variant B won, 'no_winner' = no clear winner
  winner                TEXT CHECK (winner IN ('a', 'b', 'no_winner')),

  -- Lifecycle: 'active' | 'decided' | 'expired'
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'decided', 'expired')),

  created_at            TEXT NOT NULL,             -- ISO-8601
  decided_at            TEXT,                      -- ISO-8601; set when status changes to 'decided'

  -- Optional metadata
  offer_id              TEXT,                      -- affiliate offer ID (if applicable)
  bundle_id             TEXT                       -- bundle used for this experiment
);

-- Indexes for efficient cron scans
CREATE INDEX IF NOT EXISTS idx_ab_experiments_status         ON ab_experiments (status);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_tenant_status  ON ab_experiments (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_video_id       ON ab_experiments (video_id);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_created_at     ON ab_experiments (created_at);
