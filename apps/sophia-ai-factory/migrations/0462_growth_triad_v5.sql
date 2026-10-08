-- Migration: 0462_growth_triad_v5.sql
-- Description: D1 schema for Growth Triad v5 (MAB Paywall, KOL Outreach, Hook A/B Testing)
-- Layer: seed

CREATE TABLE IF NOT EXISTS mab_paywall_arms (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  price_tier TEXT NOT NULL,
  price_usd REAL NOT NULL,
  alpha_success REAL NOT NULL DEFAULT 1.0,
  beta_failure REAL NOT NULL DEFAULT 1.0,
  impressions INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue_usd REAL NOT NULL DEFAULT 0.0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mab_arms_lookup ON mab_paywall_arms(campaign_id, is_active, price_usd);

CREATE TABLE IF NOT EXISTS kol_lead_records (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  follower_count INTEGER NOT NULL,
  median_views INTEGER NOT NULL,
  engagement_rate REAL NOT NULL,
  quality_score REAL NOT NULL,
  current_split_pct REAL NOT NULL DEFAULT 0.20,
  status TEXT NOT NULL DEFAULT 'SCOUTED',
  unsubscribed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kol_status_score ON kol_lead_records(status, quality_score);

CREATE TABLE IF NOT EXISTS hook_ab_experiments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  variants_json TEXT NOT NULL,
  winner_variant_id TEXT,
  impressions_count INTEGER NOT NULL DEFAULT 0,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_status ON hook_ab_experiments(status, updated_at);
