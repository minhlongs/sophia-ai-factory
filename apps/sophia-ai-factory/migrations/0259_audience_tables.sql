-- Migration: 0259_audience_tables
-- Audience Intelligence — audience_segments + audience_metrics tables.
-- All timestamps are MILLISECONDS (matches performance_events convention,
-- migration 0243: strftime('%s','now') * 1000).
-- Fully additive; uses IF NOT EXISTS for idempotent application.

CREATE TABLE IF NOT EXISTS audience_segments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  platforms TEXT NOT NULL DEFAULT '[]',        -- JSON array of platform ids
  content_types TEXT NOT NULL DEFAULT '[]',    -- JSON array of content types
  age_buckets TEXT NOT NULL DEFAULT '[]',      -- JSON array of age bucket ids
  countries TEXT NOT NULL DEFAULT '[]',        -- JSON array of ISO alpha-2 codes
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_aud_segments_workspace ON audience_segments(workspace_id);

CREATE TABLE IF NOT EXISTS audience_metrics (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  followers INTEGER NOT NULL DEFAULT 0,
  engagement_rate REAL NOT NULL DEFAULT 0,     -- share in [0, 1]
  demographics TEXT NOT NULL DEFAULT '{}',     -- JSON: ageBuckets/countries/genders shares
  window_start_ms INTEGER NOT NULL,            -- window start, MILLISECONDS
  window_end_ms INTEGER NOT NULL,              -- window end, MILLISECONDS
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  -- Idempotency: one row per workspace + platform + window. Re-running the
  -- same window upserts instead of duplicating.
  UNIQUE(workspace_id, platform, window_start_ms)
);

CREATE INDEX IF NOT EXISTS idx_aud_metrics_workspace ON audience_metrics(workspace_id, window_start_ms DESC);
CREATE INDEX IF NOT EXISTS idx_aud_metrics_platform ON audience_metrics(platform, window_start_ms DESC);
