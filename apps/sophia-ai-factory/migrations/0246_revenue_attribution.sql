-- Migration: 0246_revenue_attribution
-- Phase 7 Monetization OS: unified revenue attribution per content unit + channel
-- INSERT OR IGNORE semantics (D1 has no transactions) for idempotent replay

CREATE TABLE IF NOT EXISTS revenue_attribution (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL,
  content_project_id TEXT NOT NULL,
  content_asset_id TEXT,
  channel TEXT NOT NULL DEFAULT 'direct',
  network TEXT NOT NULL DEFAULT 'unknown',
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  roi REAL NOT NULL DEFAULT 0,
  attributed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_revattr_workspace ON revenue_attribution(workspace_id, attributed_at DESC);
CREATE INDEX IF NOT EXISTS idx_revattr_project ON revenue_attribution(content_project_id);
CREATE INDEX IF NOT EXISTS idx_revattr_asset ON revenue_attribution(content_asset_id);
CREATE INDEX IF NOT EXISTS idx_revattr_channel ON revenue_attribution(channel, workspace_id);
