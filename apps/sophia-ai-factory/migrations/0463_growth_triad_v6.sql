-- Migration 0463: Growth Triad v6 Tables
-- SEO Surge Tracking, Affiliate Smart-Link Yield & Retention Survival Curves

CREATE TABLE IF NOT EXISTS seo_surge_records (
  id TEXT PRIMARY KEY,
  keyword TEXT NOT NULL,
  current_velocity REAL NOT NULL,
  mean_velocity REAL NOT NULL,
  std_dev REAL NOT NULL,
  z_score REAL NOT NULL,
  is_surging INTEGER NOT NULL DEFAULT 0,
  intent TEXT NOT NULL,
  generated_title TEXT,
  generated_tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seo_surge_keyword ON seo_surge_records(keyword);
CREATE INDEX IF NOT EXISTS idx_seo_surge_zscore ON seo_surge_records(z_score);

CREATE TABLE IF NOT EXISTS affiliate_smart_offers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  network TEXT NOT NULL,
  target_url TEXT NOT NULL,
  epc_usd REAL NOT NULL DEFAULT 0.0,
  gravity REAL NOT NULL DEFAULT 0.0,
  refund_rate_pct REAL NOT NULL DEFAULT 0.0,
  commission_pct REAL NOT NULL DEFAULT 0.0,
  niche TEXT NOT NULL,
  expected_yield_usd REAL NOT NULL DEFAULT 0.0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_affiliate_smart_niche ON affiliate_smart_offers(niche);
CREATE INDEX IF NOT EXISTS idx_affiliate_smart_yield ON affiliate_smart_offers(expected_yield_usd);

CREATE TABLE IF NOT EXISTS retention_survival_reports (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  sample_size INTEGER NOT NULL,
  thirty_sec_retention REAL NOT NULL,
  cliffs_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MONITORING',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_retention_survival_vid ON retention_survival_reports(video_id);
