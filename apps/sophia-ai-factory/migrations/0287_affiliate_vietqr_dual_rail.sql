-- Migration 0287: Affiliate VietQR Dual-Rail & 2-Tier Master Progression
-- Adds Vietnamese domestic banking columns (VietQR / NAPAS 247) and dual payout rails to affiliate_partners.
-- Tracks activated MRR cents for automated tier progression (Silver 20%, Gold 25%, Platinum 30%).
-- Normalizes legacy tiers ('STANDARD', 'VIP', 'SUPER') to canonical ('SILVER', 'GOLD', 'PLATINUM').

-- 1. Add Dual-Rail & VietQR banking columns to affiliate_partners
ALTER TABLE affiliate_partners ADD COLUMN payout_rail TEXT DEFAULT 'USDT' CHECK (payout_rail IN ('USDT', 'VIETQR'));
ALTER TABLE affiliate_partners ADD COLUMN bank_bin TEXT;
ALTER TABLE affiliate_partners ADD COLUMN bank_account_number TEXT;
ALTER TABLE affiliate_partners ADD COLUMN bank_account_name TEXT;
ALTER TABLE affiliate_partners ADD COLUMN activated_mrr_cents INTEGER NOT NULL DEFAULT 0;

-- 2. Indices for fast querying and sorting
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_payout_rail ON affiliate_partners(payout_rail);
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_tier ON affiliate_partners(tier);
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_activated_mrr ON affiliate_partners(activated_mrr_cents DESC);

-- 3. Normalize legacy tiers to canonical names with updated commission rates
UPDATE affiliate_partners
SET tier = 'SILVER', commission_rate_pct = 20.0
WHERE tier = 'STANDARD';

UPDATE affiliate_partners
SET tier = 'GOLD', commission_rate_pct = 25.0
WHERE tier = 'VIP';

UPDATE affiliate_partners
SET tier = 'PLATINUM', commission_rate_pct = 30.0
WHERE tier = 'SUPER';

-- 4. Monthly Affiliate Leaderboard Snapshots table
CREATE TABLE IF NOT EXISTS affiliate_leaderboard_snapshots (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL, -- Format: YYYY-MM
  total_prize_pool_usd INTEGER NOT NULL DEFAULT 850,
  snapshot_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(period)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_leaderboard_snapshots_period ON affiliate_leaderboard_snapshots(period);

-- 5. Dual-Rail Payout Exports log table
CREATE TABLE IF NOT EXISTS affiliate_payout_exports (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  rail TEXT NOT NULL CHECK (rail IN ('USDT', 'VIETQR', 'COMBINED')),
  total_amount_usd REAL NOT NULL DEFAULT 0.0,
  total_amount_vnd INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  export_filename TEXT,
  payload_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payout_exports_batch_id ON affiliate_payout_exports(batch_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payout_exports_created_at ON affiliate_payout_exports(created_at DESC);
