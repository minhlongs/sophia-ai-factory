-- Migration: 0470_growth_v13_mab_shapley.sql
-- Growth Triad v13: MAB A/B Video Optimizer, Creative Deliberation & Shapley Profit Ledger
-- Dialect: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS growth_bandit_experiments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  experiment_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'CONVERGED' | 'PAUSED'
  winning_arm_id TEXT,
  total_pulls INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bandit_experiments_user_status
  ON growth_bandit_experiments(user_id, status);

CREATE TABLE IF NOT EXISTS growth_bandit_arms (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  hook_text TEXT NOT NULL,
  alpha_successes REAL NOT NULL DEFAULT 1.0,
  beta_failures REAL NOT NULL DEFAULT 1.0,
  pull_count INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'WINNER' | 'PRUNED'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bandit_arms_experiment
  ON growth_bandit_arms(experiment_id, status);

CREATE TABLE IF NOT EXISTS growth_shapley_touchpoints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversion_id TEXT NOT NULL,
  video_manifest_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  touchpoint_order INTEGER NOT NULL,
  shapley_weight REAL NOT NULL DEFAULT 0.0,
  attributed_revenue_usd REAL NOT NULL DEFAULT 0.0,
  mcu_cost_usd REAL NOT NULL DEFAULT 0.0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shapley_touchpoints_user_conv
  ON growth_shapley_touchpoints(user_id, conversion_id);
CREATE INDEX IF NOT EXISTS idx_shapley_touchpoints_manifest
  ON growth_shapley_touchpoints(video_manifest_id);
