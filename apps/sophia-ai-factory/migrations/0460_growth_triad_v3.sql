-- Migration 0460: Growth Triad v3 Tables
-- B2B Cold Outreach, TikTok Shop Creator CRM & Omnichannel Attribution

CREATE TABLE IF NOT EXISTS b2b_lead_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  company_domain TEXT NOT NULL,
  is_corporate_domain INTEGER NOT NULL DEFAULT 1,
  intent_score REAL NOT NULL DEFAULT 50.0,
  status TEXT NOT NULL DEFAULT 'DISCOVERED',
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  warmup_ramp_day INTEGER NOT NULL DEFAULT 1,
  booking_url TEXT,
  last_contacted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_b2b_lead_user_status ON b2b_lead_records (user_id, status);
CREATE INDEX IF NOT EXISTS idx_b2b_lead_email ON b2b_lead_records (email);

CREATE TABLE IF NOT EXISTS tiktok_creator_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  creator_handle TEXT NOT NULL,
  follower_count REAL NOT NULL DEFAULT 0,
  rolling_gmv_30d REAL NOT NULL DEFAULT 0,
  engagement_rate REAL NOT NULL DEFAULT 0,
  sample_status TEXT NOT NULL DEFAULT 'PENDING_EVALUATION',
  commission_tier TEXT NOT NULL DEFAULT 'TIER_1_STANDARD',
  sample_tracking_code TEXT,
  video_deadline_days INTEGER NOT NULL DEFAULT 7,
  attributed_sales_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tiktok_creator_user ON tiktok_creator_records (user_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_creator_handle ON tiktok_creator_records (creator_handle);

CREATE TABLE IF NOT EXISTS omnichannel_touchpoints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversion_id TEXT NOT NULL,
  channel_source TEXT NOT NULL,
  weight_percentage REAL NOT NULL,
  attributed_gmv REAL NOT NULL,
  ltv_cac_ratio REAL NOT NULL DEFAULT 1.0,
  payout_status TEXT NOT NULL DEFAULT 'PENDING',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_touchpoints_user ON omnichannel_touchpoints (user_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_conversion ON omnichannel_touchpoints (conversion_id);
