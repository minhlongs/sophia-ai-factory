-- Migration: 0021-affiliate-offers-selected
-- Creates affiliate offer selection and click tracking tables

CREATE TABLE IF NOT EXISTS affiliate_offers_selected (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  offer_id TEXT NOT NULL,
  offer_name TEXT NOT NULL,
  affiliate_link TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  network TEXT NOT NULL DEFAULT 'clickbank' CHECK (network IN ('clickbank','shareasale','amazon','manual')),
  commission_rate REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_affoff_campaign ON affiliate_offers_selected(campaign_id);
CREATE INDEX IF NOT EXISTS idx_affoff_user ON affiliate_offers_selected(user_id);
CREATE INDEX IF NOT EXISTS idx_affoff_short_code ON affiliate_offers_selected(short_code);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  click_id TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  offer_id TEXT NOT NULL,
  short_code TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clicks_click_id ON affiliate_clicks(click_id);
CREATE INDEX IF NOT EXISTS idx_clicks_campaign ON affiliate_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_clicks_user ON affiliate_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_clicks_created ON affiliate_clicks(created_at DESC);
