-- Migration 0282: Affiliate Partner Program
-- Multi-tier affiliate partner management with encrypted USDT TRC20 payout address and recurring MRR tracking.

CREATE TABLE IF NOT EXISTS affiliate_partners (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  partner_code TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'STANDARD' CHECK (tier IN ('STANDARD', 'VIP', 'SUPER')),
  commission_rate_pct REAL NOT NULL DEFAULT 20.0,
  tier2_rate_pct REAL NOT NULL DEFAULT 5.0,
  parent_partner_id TEXT REFERENCES affiliate_partners(id),
  usdt_trc20_address_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'under_review')),
  total_earnings_cents INTEGER NOT NULL DEFAULT 0,
  pending_payout_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_partners_user_id ON affiliate_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_partner_code ON affiliate_partners(partner_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_parent_id ON affiliate_partners(parent_partner_id);

CREATE TABLE IF NOT EXISTS affiliate_referral_clicks (
  id TEXT PRIMARY KEY,
  affiliate_partner_id TEXT NOT NULL REFERENCES affiliate_partners(id),
  partner_code TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  referer_url TEXT,
  sub_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_partner ON affiliate_referral_clicks(affiliate_partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_code ON affiliate_referral_clicks(partner_code);
