-- Migration 0283: Leads Lifecycle & Viral Funnel Metrics
-- Supports omnichannel lead capture (Telegram bot, viral video, SEO, affiliate) and funnel analytics.

CREATE TABLE IF NOT EXISTS growth_leads (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('telegram_bot', 'viral_video', 'seo_landing', 'affiliate', 'direct')),
  telegram_chat_id TEXT,
  telegram_username TEXT,
  niche TEXT,
  budget TEXT,
  lead_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'demo_sent', 'checkout_opened', 'converted', 'lost')),
  utm_source TEXT,
  utm_campaign TEXT,
  affiliate_partner_id TEXT REFERENCES affiliate_partners(id),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_growth_leads_source ON growth_leads(source);
CREATE INDEX IF NOT EXISTS idx_growth_leads_status ON growth_leads(status);
CREATE INDEX IF NOT EXISTS idx_growth_leads_affiliate ON growth_leads(affiliate_partner_id);
CREATE INDEX IF NOT EXISTS idx_growth_leads_created ON growth_leads(created_at DESC);

-- Unified telegram_leads table supporting Telegram Sales FSM, qualification scoring, and attribution
CREATE TABLE IF NOT EXISTS telegram_leads (
  id TEXT PRIMARY KEY,
  telegram_chat_id TEXT NOT NULL UNIQUE,
  telegram_user_id TEXT,
  telegram_username TEXT,
  username TEXT,
  first_name TEXT,
  niche TEXT,
  budget_tier TEXT,
  budget TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  lead_score INTEGER NOT NULL DEFAULT 0,
  qualification_score INTEGER NOT NULL DEFAULT 0,
  demo_video_sent_at TEXT,
  source_utm TEXT,
  campaign_id TEXT,
  referrer_id TEXT,
  promo_code_used TEXT,
  promo_code_offered TEXT,
  payment_method_selected TEXT,
  checkout_order_id TEXT,
  is_paid INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT DEFAULT '{}',
  affiliate_partner_id TEXT REFERENCES affiliate_partners(id),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_telegram_leads_chat_id ON telegram_leads(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_leads_status ON telegram_leads(status);
CREATE INDEX IF NOT EXISTS idx_telegram_leads_score ON telegram_leads(lead_score);
CREATE INDEX IF NOT EXISTS idx_telegram_leads_qual_score ON telegram_leads(qualification_score);
CREATE INDEX IF NOT EXISTS idx_telegram_leads_created ON telegram_leads(created_at DESC);

-- Viral funnel links with complete metrics telemetry
CREATE TABLE IF NOT EXISTS viral_funnel_links (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  video_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'youtube_shorts', 'twitter', 'x', 'facebook_reels', 'instagram_reels')),
  hook_archetype TEXT,
  target_niche TEXT,
  destination_url TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  short_code TEXT UNIQUE,
  views_count INTEGER NOT NULL DEFAULT 0,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  leads_count INTEGER NOT NULL DEFAULT 0,
  conversions_count INTEGER NOT NULL DEFAULT 0,
  revenue_usd REAL NOT NULL DEFAULT 0,
  affiliate_partner_id TEXT REFERENCES affiliate_partners(id),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_viral_funnel_video_platform ON viral_funnel_links(video_id, platform);
CREATE INDEX IF NOT EXISTS idx_viral_funnel_short_code ON viral_funnel_links(short_code);
CREATE INDEX IF NOT EXISTS idx_viral_funnel_user_id ON viral_funnel_links(user_id);
CREATE INDEX IF NOT EXISTS idx_viral_funnel_created ON viral_funnel_links(created_at DESC);
