-- Migration: 0472_growth_v15_performance_feedback.sql
-- Description: Growth Triad v15 Bayesian Feedback Loop & Retention Telemetry Persistence
-- Layer: seed/db/migrations

CREATE TABLE IF NOT EXISTS growth_post_publish_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_manifest_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  watch_time_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL NOT NULL,
  retention_curve_json TEXT NOT NULL,
  ctr REAL DEFAULT 0,
  virality_score REAL DEFAULT 0,
  normalized_completion_score REAL NOT NULL DEFAULT 0,
  hook_dropoff_rate REAL NOT NULL DEFAULT 0,
  collected_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gppf_user_collected
  ON growth_post_publish_feedback (user_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_gppf_manifest
  ON growth_post_publish_feedback (video_manifest_id);

CREATE TABLE IF NOT EXISTS growth_bayesian_priors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  dimension_key TEXT NOT NULL,
  dimension_val TEXT NOT NULL,
  alpha REAL NOT NULL DEFAULT 1.0,
  beta REAL NOT NULL DEFAULT 1.0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, dimension_key, dimension_val)
);

CREATE INDEX IF NOT EXISTS idx_gbp_user_dim
  ON growth_bayesian_priors (user_id, dimension_key);
