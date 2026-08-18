-- Migration 0247: Content-to-Affiliate Link Mapping (Phase 7 — Monetization OS)
-- Links generated content (content_projects/content_assets) to affiliate_links
-- that promote them, enabling per-content revenue attribution.

CREATE TABLE IF NOT EXISTS content_affiliate_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  content_project_id TEXT NOT NULL,
  content_asset_id TEXT,
  link_id TEXT NOT NULL,
  affiliate_code TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'active',
  attribution_id TEXT,
  generated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_cal_workspace ON content_affiliate_links(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cal_project ON content_affiliate_links(content_project_id);
CREATE INDEX IF NOT EXISTS idx_cal_link ON content_affiliate_links(link_id);
CREATE INDEX IF NOT EXISTS idx_cal_attribution ON content_affiliate_links(attribution_id) WHERE attribution_id IS NOT NULL;
