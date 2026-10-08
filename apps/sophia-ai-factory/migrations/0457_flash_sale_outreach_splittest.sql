-- Migration: 0457_flash_sale_outreach_splittest.sql
-- Live Flash-Sale Sync, Competitor Outreach Leads & Video Split-Test Attribution

CREATE TABLE IF NOT EXISTS live_flash_sale_campaigns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES live_stream_sessions(id),
  offer_id TEXT NOT NULL,
  voucher_code TEXT NOT NULL,
  discount_percentage INTEGER NOT NULL,
  stock_remaining INTEGER NOT NULL,
  surge_threshold_percentage INTEGER NOT NULL DEFAULT 20,
  is_active INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS competitor_outreach_leads (
  id TEXT PRIMARY KEY,
  competitor_channel TEXT NOT NULL,
  target_video_id TEXT NOT NULL,
  comment_author_id TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  intent_score INTEGER NOT NULL DEFAULT 50,
  outreach_status TEXT NOT NULL DEFAULT 'DISCOVERED' CHECK(outreach_status IN ('DISCOVERED', 'DISPATCHED', 'CONVERTED', 'OPT_OUT', 'SUPPRESSED')),
  message_template_used TEXT,
  dispatched_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS video_split_test_experiments (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  hook_a_video_id TEXT NOT NULL,
  hook_b_video_id TEXT NOT NULL,
  traffic_split_ratio REAL NOT NULL DEFAULT 0.5,
  variant_a_views INTEGER NOT NULL DEFAULT 0,
  variant_a_clicks INTEGER NOT NULL DEFAULT 0,
  variant_a_conversions INTEGER NOT NULL DEFAULT 0,
  variant_b_views INTEGER NOT NULL DEFAULT 0,
  variant_b_clicks INTEGER NOT NULL DEFAULT 0,
  variant_b_conversions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'RUNNING' CHECK(status IN ('RUNNING', 'WINNER_DECLARED', 'AUTO_CUT_TRIGGERED', 'STOPPED')),
  winner_variant TEXT CHECK(winner_variant IN ('VARIANT_A', 'VARIANT_B', 'INCONCLUSIVE')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_flash_sale_session ON live_flash_sale_campaigns(session_id, is_active);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON competitor_outreach_leads(outreach_status, intent_score);
CREATE INDEX IF NOT EXISTS idx_splittest_status ON video_split_test_experiments(status);
