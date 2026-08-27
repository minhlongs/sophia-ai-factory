-- Migration: 0258_distribution_tables
-- Phase 4: Distribution + Commerce — Distribution OS tables
-- Adds distribution_plans and distribution_posts tables for multi-channel publishing.
-- Fully additive; uses IF NOT EXISTS for idempotent application.

CREATE TABLE IF NOT EXISTS distribution_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  channels TEXT NOT NULL DEFAULT '[]',
  schedule_at INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',        -- draft|scheduled|executing|completed|failed
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_dist_plans_workspace ON distribution_plans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dist_plans_asset ON distribution_plans(asset_id);
CREATE INDEX IF NOT EXISTS idx_dist_plans_status ON distribution_plans(status);

CREATE TABLE IF NOT EXISTS distribution_posts (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',     -- scheduled|uploading|processing|published|failed
  scheduled_at INTEGER NOT NULL,
  posted_at INTEGER,
  error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_dist_posts_plan ON distribution_posts(plan_id);
CREATE INDEX IF NOT EXISTS idx_dist_posts_platform ON distribution_posts(platform);
CREATE INDEX IF NOT EXISTS idx_dist_posts_status ON distribution_posts(status);
CREATE INDEX IF NOT EXISTS idx_dist_posts_idempotency ON distribution_posts(idempotency_key);