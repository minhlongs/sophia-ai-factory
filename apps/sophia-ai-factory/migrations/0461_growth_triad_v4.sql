-- Migration: 0461_growth_triad_v4.sql
-- Description: Growth Triad v4 D1 SQLite tables for Churn Win-Back, Affiliate EPC Co-Pilot, and Repurpose Pipelines

CREATE TABLE IF NOT EXISTS churn_winback_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  days_inactive INTEGER NOT NULL DEFAULT 0,
  churn_hazard_score REAL NOT NULL DEFAULT 0.0,
  risk_level TEXT NOT NULL,
  discount_percentage REAL NOT NULL DEFAULT 0.0,
  bonus_mcu INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'EVALUATED',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_churn_winback_user ON churn_winback_records(user_id, risk_level);

CREATE TABLE IF NOT EXISTS affiliate_epc_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  clicks_7d INTEGER NOT NULL DEFAULT 0,
  conversions_7d INTEGER NOT NULL DEFAULT 0,
  gross_revenue_usd REAL NOT NULL DEFAULT 0.0,
  calculated_epc REAL NOT NULL DEFAULT 0.0,
  commission_tier TEXT NOT NULL DEFAULT 'STANDARD',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_affiliate_epc_camp ON affiliate_epc_records(campaign_id, calculated_epc);

CREATE TABLE IF NOT EXISTS viral_repurpose_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_video_id TEXT NOT NULL,
  target_format TEXT NOT NULL,
  saliency_hook_score REAL NOT NULL DEFAULT 0.0,
  focal_x REAL NOT NULL DEFAULT 0.5,
  focal_y REAL NOT NULL DEFAULT 0.5,
  crop_box_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_viral_repurpose_user ON viral_repurpose_records(user_id, status);
