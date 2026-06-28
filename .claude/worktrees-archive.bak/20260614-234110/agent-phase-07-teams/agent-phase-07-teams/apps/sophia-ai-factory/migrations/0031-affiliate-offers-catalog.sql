-- Migration: 0031-affiliate-offers-catalog
-- Public catalog of affiliate offers shown on /affiliate-discovery.
-- Distinct from affiliate_offers_selected (per-user per-campaign tracking).

CREATE TABLE IF NOT EXISTS affiliate_offers_catalog (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  offer_name TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('clickbank','shareasale','amazon','impact','cj','manual')),
  url TEXT NOT NULL,
  commission_rate REAL,
  category TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_catalog_active_created ON affiliate_offers_catalog(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_network ON affiliate_offers_catalog(network);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON affiliate_offers_catalog(category);
