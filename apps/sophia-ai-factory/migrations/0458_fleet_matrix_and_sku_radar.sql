-- Migration 0458: Multi-Account Fleet Matrix & Trending SKU Radar
-- Layer: Database Schema

-- 1. Fleet Creator Accounts Table
CREATE TABLE IF NOT EXISTS fleet_creator_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('TIKTOK', 'YOUTUBE', 'INSTAGRAM', 'FACEBOOK')),
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  proxy_config_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'WARMING_UP', 'COOLDOWN', 'SUSPENDED')),
  daily_post_limit INTEGER NOT NULL DEFAULT 3,
  posts_published_today INTEGER NOT NULL DEFAULT 0,
  last_post_at INTEGER,
  total_views INTEGER NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_gmv REAL NOT NULL DEFAULT 0,
  total_commission REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fleet_accounts_user_platform ON fleet_creator_accounts(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_fleet_accounts_status ON fleet_creator_accounts(status);

-- 2. Trending SKU Radar Items Table
CREATE TABLE IF NOT EXISTS trending_sku_radar_items (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK(platform IN ('TIKTOK_SHOP', 'SHOPEE', 'CLICKBANK')),
  sku_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_category TEXT NOT NULL,
  product_image_url TEXT,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  commission_rate REAL NOT NULL,
  estimated_commission REAL NOT NULL,
  daily_sales_volume INTEGER NOT NULL DEFAULT 0,
  growth_velocity_score REAL NOT NULL DEFAULT 0,
  hot_trend_tier TEXT NOT NULL DEFAULT 'STEADY' CHECK(hot_trend_tier IN ('BREAKOUT', 'SURGING', 'STEADY', 'COOLING')),
  affiliate_url TEXT NOT NULL,
  top_selling_hook_summary TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sku_radar_velocity ON trending_sku_radar_items(growth_velocity_score DESC);
CREATE INDEX IF NOT EXISTS idx_sku_radar_tier ON trending_sku_radar_items(hot_trend_tier);
CREATE INDEX IF NOT EXISTS idx_sku_radar_platform ON trending_sku_radar_items(platform);

-- 3. Fleet Campaign Deployments Table
CREATE TABLE IF NOT EXISTS fleet_campaign_deployments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sku_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  target_fleet_account_ids TEXT NOT NULL, -- JSON array of account IDs
  generated_hook_angles TEXT NOT NULL,    -- JSON array of angles
  bridge_page_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'GENERATING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED')),
  stagger_interval_minutes INTEGER NOT NULL DEFAULT 30,
  total_assigned_accounts INTEGER NOT NULL DEFAULT 0,
  total_published_videos INTEGER NOT NULL DEFAULT 0,
  aggregate_gmv REAL NOT NULL DEFAULT 0,
  aggregate_commission REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fleet_deployments_user ON fleet_campaign_deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_fleet_deployments_sku ON fleet_campaign_deployments(sku_id);
CREATE INDEX IF NOT EXISTS idx_fleet_deployments_status ON fleet_campaign_deployments(status);
