-- Migration: 0459_growth_triad_v2.sql
-- Description: D1 tables for Growth Triad v2: Voice Cart Closer, Ad Arbitrage MAB & Parasite SEO

CREATE TABLE IF NOT EXISTS abandoned_cart_voice_calls (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  cart_session_id TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  cart_value REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'VND',
  product_names TEXT NOT NULL DEFAULT '[]',
  call_status TEXT NOT NULL DEFAULT 'PENDING',
  objection_detected TEXT,
  offered_voucher_code TEXT,
  offered_discount_percent REAL,
  recording_duration_seconds INTEGER NOT NULL DEFAULT 0,
  converted_gmv REAL NOT NULL DEFAULT 0,
  call_timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cart_voice_user_id ON abandoned_cart_voice_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_voice_status ON abandoned_cart_voice_calls(call_status);

CREATE TABLE IF NOT EXISTS ad_arbitrage_campaigns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  campaign_external_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  daily_budget REAL NOT NULL,
  rolling_spend_24h REAL NOT NULL DEFAULT 0,
  rolling_gmv_24h REAL NOT NULL DEFAULT 0,
  rolling_clicks_24h INTEGER NOT NULL DEFAULT 0,
  rolling_conversions_24h INTEGER NOT NULL DEFAULT 0,
  cpa REAL NOT NULL DEFAULT 0,
  roas REAL NOT NULL DEFAULT 0,
  epc REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  recommended_action TEXT NOT NULL DEFAULT 'MAINTAIN',
  last_rebalanced_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ad_arbitrage_user_id ON ad_arbitrage_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_arbitrage_status ON ad_arbitrage_campaigns(status);

CREATE TABLE IF NOT EXISTS parasite_seo_articles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sku_code TEXT NOT NULL,
  title TEXT NOT NULL,
  target_platform TEXT NOT NULL,
  canonical_slug TEXT NOT NULL,
  cloaked_bridge_url TEXT NOT NULL,
  target_keywords TEXT NOT NULL DEFAULT '[]',
  schema_org_json_ld TEXT NOT NULL,
  seo_content_markdown TEXT NOT NULL,
  seo_score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  published_external_url TEXT,
  organic_impressions INTEGER NOT NULL DEFAULT 0,
  organic_clicks INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parasite_seo_user_id ON parasite_seo_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_parasite_seo_sku ON parasite_seo_articles(sku_code);
