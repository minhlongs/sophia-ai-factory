-- Migration 0082: Edge tracking tables for cookieless S2S affiliate postback
-- Provides: tracking_links, tracking_clicks, tracking_conversions

CREATE TABLE IF NOT EXISTS tracking_links (
  id TEXT PRIMARY KEY,                         -- 8-char base62 ID
  tenant_id TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  affiliate_id TEXT,                           -- FK to discovered_affiliates (optional)
  campaign_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_tracking_tenant ON tracking_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tracking_active ON tracking_links(active);

CREATE TABLE IF NOT EXISTS tracking_clicks (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash TEXT,              -- sha256(ip + tenant_secret) for privacy — raw IP NOT stored
  user_agent TEXT,
  referrer TEXT,
  country TEXT,              -- from CF-IPCountry header
  FOREIGN KEY (link_id) REFERENCES tracking_links(id)
);

CREATE INDEX IF NOT EXISTS idx_clicks_link ON tracking_clicks(link_id, ts DESC);

CREATE TABLE IF NOT EXISTS tracking_conversions (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  network TEXT,
  external_conversion_id TEXT,
  amount_usd REAL,
  ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_payload TEXT,          -- JSON string of full postback payload
  FOREIGN KEY (link_id) REFERENCES tracking_links(id)
);

CREATE INDEX IF NOT EXISTS idx_conv_link ON tracking_conversions(link_id, ts DESC);
