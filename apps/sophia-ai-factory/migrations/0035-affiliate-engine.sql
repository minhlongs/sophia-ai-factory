-- Migration 0035: Affiliate Engine (Phase 09)
-- Creates 5 tables for multi-network affiliate offer management

CREATE TABLE IF NOT EXISTS affiliate_networks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  api_endpoint TEXT,
  postback_url TEXT,
  hmac_secret_key TEXT,
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS affiliate_offers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  network_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  image_url TEXT,
  product_url TEXT NOT NULL,
  commission_pct REAL,
  commission_fixed_usd REAL,
  niche TEXT,
  language TEXT,
  region TEXT,
  is_trending INTEGER DEFAULT 0,
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(network_id, external_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS affiliate_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  campaign_name TEXT,
  sub_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS click_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  link_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  ip_hash TEXT,
  ua TEXT,
  referrer TEXT,
  country TEXT,
  clicked_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversion_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  link_id TEXT NOT NULL,
  click_id TEXT,
  network_transaction_id TEXT NOT NULL,
  gross_amount_usd REAL NOT NULL,
  commission_usd REAL NOT NULL,
  status TEXT CHECK(status IN ('pending','approved','rejected','paid')),
  attributed_at INTEGER NOT NULL,
  UNIQUE(network_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_offers_tenant_niche ON affiliate_offers(tenant_id, niche, is_trending);
CREATE INDEX IF NOT EXISTS idx_links_tenant_code ON affiliate_links(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_click_tenant_link ON click_events(tenant_id, link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_tenant_status ON conversion_events(tenant_id, status, attributed_at DESC);
