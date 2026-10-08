-- Migration: 0456_live_stream_newsjack_dm.sql
-- Live-Commerce Streamer, Newsjacking Signals & Comment-to-DM Attribution Ledger

CREATE TABLE IF NOT EXISTS live_stream_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('tiktok', 'shopee', 'youtube', 'twitch')),
  stream_key_masked TEXT NOT NULL,
  loop_video_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IDLE' CHECK(status IN ('IDLE', 'BROADCASTING', 'PAUSED', 'ENDED', 'ERROR')),
  current_pinned_offer_id TEXT,
  viewers_count INTEGER NOT NULL DEFAULT 0,
  qa_turnaround_ms INTEGER NOT NULL DEFAULT 850,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS newsjack_signals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  trend_topic TEXT NOT NULL,
  trend_source TEXT NOT NULL CHECK(trend_source IN ('google_trends_rss', 'tiktok_creative_center', 'x_trends')),
  virality_score INTEGER NOT NULL DEFAULT 50,
  paired_offer_id TEXT,
  paired_similarity_score REAL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'GENERATING', 'COMPLETED', 'DISMISSED', 'FAILED')),
  generated_video_job_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS dm_leads (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK(platform IN ('tiktok', 'instagram', 'youtube', 'telegram', 'whatsapp')),
  platform_user_id TEXT NOT NULL,
  platform_username TEXT,
  source_video_id TEXT,
  source_comment_id TEXT,
  initial_intent TEXT,
  funnel_state TEXT NOT NULL DEFAULT 'NEW' CHECK(funnel_state IN ('NEW', 'QUALIFIED', 'LINK_SENT', 'CLICKED', 'CONVERTED', 'LOST', 'OPTED_OUT')),
  assigned_offer_id TEXT,
  lead_score INTEGER NOT NULL DEFAULT 10,
  opted_out INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS dm_conversion_ledger (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES dm_leads(id),
  offer_id TEXT NOT NULL,
  click_id TEXT UNIQUE NOT NULL,
  sub_id TEXT NOT NULL,
  utm_campaign TEXT,
  affiliate_network TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'SETTLED')),
  payout_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  postback_payload TEXT,
  converted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_user ON live_stream_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_newsjack_user_status ON newsjack_signals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_dm_leads_plat_user ON dm_leads(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_dm_leads_funnel ON dm_leads(funnel_state);
CREATE INDEX IF NOT EXISTS idx_dm_ledger_subid ON dm_conversion_ledger(sub_id);
CREATE INDEX IF NOT EXISTS idx_dm_ledger_click ON dm_conversion_ledger(click_id);
