-- Migration 0296: Global Partner & Reseller Multi-Tier Portal (White-Label Agency Engine)
-- Supports Milestone 3 (R3): Autonomous Partner Multi-Tier Commission Ledger & Agency White-Label

-- 1. Create partner_profiles table
CREATE TABLE IF NOT EXISTS partner_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  partner_type TEXT NOT NULL CHECK(partner_type IN ('agency', 'reseller', 'affiliate', 'integrator')),
  tier TEXT NOT NULL DEFAULT 'SILVER' CHECK(tier IN ('SILVER', 'GOLD', 'PLATINUM')),
  commission_rate_pct REAL NOT NULL DEFAULT 20.0,
  referral_code TEXT NOT NULL UNIQUE,
  custom_domain TEXT UNIQUE,
  whitelabel_enabled INTEGER NOT NULL DEFAULT 0,
  total_referred_customers INTEGER NOT NULL DEFAULT 0,
  total_mrr_cents INTEGER NOT NULL DEFAULT 0,
  total_earnings_cents INTEGER NOT NULL DEFAULT 0,
  pending_payout_cents INTEGER NOT NULL DEFAULT 0,
  payout_rail TEXT DEFAULT 'USDT' CHECK(payout_rail IN ('USDT', 'VIETQR', 'BANK_WIRE')),
  payout_destination_json TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending_approval')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_partner_ref_code ON partner_profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_partner_domain ON partner_profiles(custom_domain);
CREATE INDEX IF NOT EXISTS idx_partner_tier ON partner_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_partner_user ON partner_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_tenant ON partner_profiles(tenant_id);

-- 2. Create partner_commissions table
CREATE TABLE IF NOT EXISTS partner_commissions (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL,
  referred_tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  mrr_cents INTEGER NOT NULL,
  commission_rate_pct REAL NOT NULL,
  commission_cents INTEGER NOT NULL,
  tier_at_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'paid', 'clawed_back')),
  payout_batch_id TEXT,
  period_start INTEGER,
  period_end INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (partner_id) REFERENCES partner_profiles(id),
  UNIQUE(partner_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_batch ON partner_commissions(payout_batch_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_order ON partner_commissions(order_id);

-- 3. Create partner_whitelabel_configs table
CREATE TABLE IF NOT EXISTS partner_whitelabel_configs (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL UNIQUE,
  brand_name TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#06b6d4',
  accent_color TEXT DEFAULT '#3b82f6',
  custom_domain TEXT UNIQUE,
  custom_email_sender TEXT,
  support_url TEXT,
  footer_html TEXT,
  is_ssl_active INTEGER NOT NULL DEFAULT 0,
  dns_txt_verification_token TEXT,
  dns_verified_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (partner_id) REFERENCES partner_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_whitelabel_domain ON partner_whitelabel_configs(custom_domain);
CREATE INDEX IF NOT EXISTS idx_whitelabel_partner ON partner_whitelabel_configs(partner_id);
