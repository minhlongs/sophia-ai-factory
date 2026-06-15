-- Migration 0081: URL-to-Revenue orchestrator jobs table
-- Tracks end-to-end job state for: paste URL → scripts → render → publish pipeline

CREATE TABLE IF NOT EXISTS url_to_revenue_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued|scripting|rendering|publishing|completed|failed
  channels_json TEXT NOT NULL DEFAULT '[]',    -- JSON array of channel names
  locales_json TEXT NOT NULL DEFAULT '[]',     -- JSON array of locale codes
  variants_count INTEGER NOT NULL DEFAULT 3,
  tracking_id TEXT,                            -- FK to tracking_links.id (optional)
  product_title TEXT,
  product_description TEXT,
  product_image_url TEXT,
  product_price TEXT,
  variants_json TEXT NOT NULL DEFAULT '[]',    -- JSON array of URLToRevenueVariant
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_url_revenue_tenant ON url_to_revenue_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_url_revenue_status ON url_to_revenue_jobs(status);
