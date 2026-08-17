-- Content Graph — Sophia 2027 Creative Economy OS
-- ContentProject → ContentAsset → DerivativeAsset
-- Layer: tree (domain-specific reusable)

CREATE TABLE IF NOT EXISTS content_projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  creator_id TEXT NOT NULL,
  brand_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'video_long',
  status TEXT NOT NULL DEFAULT 'draft',
  budget_cents INTEGER NOT NULL DEFAULT 0,
  actual_cost_cents INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_projects_workspace
  ON content_projects (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_projects_mission
  ON content_projects (mission_id);

CREATE TABLE IF NOT EXISTS content_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_key TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_assets_project
  ON content_assets (project_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_content_assets_workspace
  ON content_assets (workspace_id, status);

CREATE TABLE IF NOT EXISTS derivative_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_asset_id TEXT NOT NULL,
  parent_asset_id TEXT,
  type TEXT NOT NULL,
  storage_key TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_derivative_assets_source
  ON derivative_assets (source_asset_id);
CREATE INDEX IF NOT EXISTS idx_derivative_assets_workspace
  ON derivative_assets (workspace_id, created_at DESC);