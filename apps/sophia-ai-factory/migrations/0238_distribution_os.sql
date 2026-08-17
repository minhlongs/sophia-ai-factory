-- Distribution OS: plans + per-asset posting records
-- Layer: tree (domain-specific reusable)

CREATE TABLE IF NOT EXISTS distribution_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  channels TEXT NOT NULL DEFAULT '[]',
  schedule_at INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS distribution_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  platform_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at INTEGER NOT NULL,
  posted_at INTEGER,
  analytics TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dist_assets_plan ON distribution_assets(plan_id);
CREATE INDEX IF NOT EXISTS idx_dist_assets_asset ON distribution_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_dist_plans_workspace ON distribution_plans(workspace_id);
