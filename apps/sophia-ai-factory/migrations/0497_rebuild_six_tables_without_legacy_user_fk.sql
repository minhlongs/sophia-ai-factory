-- Migration 0497: remove legacy `users` FKs from the six tables tracked in GH-120
-- (`payouts`, `user_wallets`, `affiliate_clicks`, `scheduled_campaigns`,
-- `video_analytics`, `marketplace_templates`).
--
-- Migration 0439 retires `users` after moving auth to Better Auth's singular
-- `user` table. Any retained `REFERENCES users(id)` makes writes fail with
-- "no such table: main.users" under `PRAGMA foreign_keys = ON`.
--
-- All column definitions, defaults, CHECK constraints, UNIQUE constraints,
-- non-`users` foreign keys (`affiliate_clicks.campaign_id REFERENCES campaigns(id)`),
-- and indexes match the verified live D1 `sqlite_master` definitions captured
-- on 2026-11-07.
--
-- Safe to re-run: staging tables use `DROP TABLE IF EXISTS` and indexes use
-- `CREATE INDEX IF NOT EXISTS`.

PRAGMA foreign_keys = OFF;

-- 1. payouts (from 0031-payouts-schema.sql; drops user_id + paid_by_admin FKs to users)
DROP TABLE IF EXISTS payouts_new;

CREATE TABLE payouts_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL CHECK (method IN ('usdt_trc20','usdt_erc20','bank_transfer','other')),
  reference TEXT,
  notes TEXT,
  paid_by_admin TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO payouts_new (
  id, user_id, amount, currency, method, reference, notes, paid_by_admin, created_at
)
SELECT
  id, user_id, amount, currency, method, reference, notes, paid_by_admin, created_at
FROM payouts;

DROP TABLE payouts;
ALTER TABLE payouts_new RENAME TO payouts;

CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_created ON payouts(created_at DESC);

-- 2. user_wallets (from 0023-affiliate-schema.sql + 0041 last_rebuilt_at; drops user_id FK to users)
DROP TABLE IF EXISTS user_wallets_new;

CREATE TABLE user_wallets_new (
  user_id TEXT PRIMARY KEY,
  balance_pending REAL NOT NULL DEFAULT 0,
  balance_available REAL NOT NULL DEFAULT 0,
  balance_paid_out REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  last_rebuilt_at INTEGER,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO user_wallets_new (
  user_id, balance_pending, balance_available, balance_paid_out, currency, last_rebuilt_at, updated_at
)
SELECT
  user_id, balance_pending, balance_available, balance_paid_out, currency, last_rebuilt_at, updated_at
FROM user_wallets;

DROP TABLE user_wallets;
ALTER TABLE user_wallets_new RENAME TO user_wallets;

-- 3. affiliate_clicks (from 0023-affiliate-schema.sql; preserves campaign_id -> campaigns(id), drops user_id FK to users)
DROP TABLE IF EXISTS affiliate_clicks_new;

CREATE TABLE affiliate_clicks_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  click_id TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  short_code TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO affiliate_clicks_new (
  id, click_id, campaign_id, user_id, offer_id, short_code, ip_hash, user_agent, referer, country, created_at
)
SELECT
  id, click_id, campaign_id, user_id, offer_id, short_code, ip_hash, user_agent, referer, country, created_at
FROM affiliate_clicks;

DROP TABLE affiliate_clicks;
ALTER TABLE affiliate_clicks_new RENAME TO affiliate_clicks;

CREATE INDEX IF NOT EXISTS idx_clicks_click_id ON affiliate_clicks(click_id);
CREATE INDEX IF NOT EXISTS idx_clicks_campaign ON affiliate_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_clicks_user ON affiliate_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_clicks_created ON affiliate_clicks(created_at DESC);

-- 4. scheduled_campaigns (from 0053-scheduled-campaigns.sql; drops user_id FK to users)
DROP TABLE IF EXISTS scheduled_campaigns_new;

CREATE TABLE scheduled_campaigns_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  template_script TEXT,
  interval_days INTEGER NOT NULL DEFAULT 7 CHECK (interval_days >= 1 AND interval_days <= 365),
  next_run_date TEXT NOT NULL,
  last_run_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO scheduled_campaigns_new (
  id, user_id, topic, template_script, interval_days, next_run_date, last_run_date, is_active, created_at, updated_at
)
SELECT
  id, user_id, topic, template_script, interval_days, next_run_date, last_run_date, is_active, created_at, updated_at
FROM scheduled_campaigns;

DROP TABLE scheduled_campaigns;
ALTER TABLE scheduled_campaigns_new RENAME TO scheduled_campaigns;

CREATE INDEX IF NOT EXISTS idx_scheduled_campaigns_user_next_run ON scheduled_campaigns(user_id, next_run_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_campaigns_due ON scheduled_campaigns(is_active, next_run_date);

-- 5. video_analytics (from 0125_phase06_features.sql; drops user_id FK to users)
DROP TABLE IF EXISTS video_analytics_new;

CREATE TABLE video_analytics_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_video_id TEXT NOT NULL,
  date TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  watch_time_sec INTEGER DEFAULT 0,
  completion_rate REAL DEFAULT 0.0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id, platform, date)
);

INSERT INTO video_analytics_new (
  id, user_id, video_id, platform, platform_video_id, date,
  views, watch_time_sec, completion_rate, impressions, clicks, likes, comments, shares, synced_at
)
SELECT
  id, user_id, video_id, platform, platform_video_id, date,
  views, watch_time_sec, completion_rate, impressions, clicks, likes, comments, shares, synced_at
FROM video_analytics;

DROP TABLE video_analytics;
ALTER TABLE video_analytics_new RENAME TO video_analytics;

CREATE INDEX IF NOT EXISTS idx_video_analytics_user_id ON video_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_video_id ON video_analytics(video_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_date ON video_analytics(date);

-- 6. marketplace_templates (from 0125_phase06_features.sql; drops creator_id FK to users)
DROP TABLE IF EXISTS marketplace_templates_new;

CREATE TABLE marketplace_templates_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  creator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  template_config TEXT NOT NULL,
  preview_r2_key TEXT,
  price_cents INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  rating REAL DEFAULT 0.0,
  rating_count INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO marketplace_templates_new (
  id, creator_id, title, description, template_config, preview_r2_key,
  price_cents, downloads, rating, rating_count, is_public, created_at
)
SELECT
  id, creator_id, title, description, template_config, preview_r2_key,
  price_cents, downloads, rating, rating_count, is_public, created_at
FROM marketplace_templates;

DROP TABLE marketplace_templates;
ALTER TABLE marketplace_templates_new RENAME TO marketplace_templates;

PRAGMA foreign_keys = ON;
