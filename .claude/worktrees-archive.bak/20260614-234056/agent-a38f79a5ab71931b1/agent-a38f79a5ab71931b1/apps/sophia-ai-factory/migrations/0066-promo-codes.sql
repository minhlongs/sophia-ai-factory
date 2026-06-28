-- Migration 0066: Promo codes + redemptions tables
-- Supports percent_off, fixed_off, free_trial, free_full discount types

CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent_off','fixed_off','free_trial','free_full')),
  discount_value INTEGER NOT NULL DEFAULT 0,
  applies_to_tier TEXT,
  applies_to_sku TEXT,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  max_uses_per_user INTEGER NOT NULL DEFAULT 1,
  valid_from INTEGER NOT NULL DEFAULT (unixepoch()),
  valid_until INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','expired')),
  created_by_admin_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  promo_code_id TEXT NOT NULL,
  promo_code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT,
  applied_to_tier TEXT,
  applied_to_sku TEXT,
  discount_applied_cents INTEGER NOT NULL DEFAULT 0,
  trial_days_granted INTEGER NOT NULL DEFAULT 0,
  redeemed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  payment_id TEXT,
  handover_id TEXT,
  status TEXT NOT NULL DEFAULT 'redeemed' CHECK (status IN ('redeemed','reverted','reserved'))
);

CREATE INDEX IF NOT EXISTS promo_codes_code_idx ON promo_codes(code);
CREATE INDEX IF NOT EXISTS promo_codes_status_idx ON promo_codes(status, valid_until);
CREATE INDEX IF NOT EXISTS promo_redemptions_code_idx ON promo_code_redemptions(promo_code_id, redeemed_at);
CREATE INDEX IF NOT EXISTS promo_redemptions_user_idx ON promo_code_redemptions(user_id, redeemed_at);

-- Add trial_ends_at to subscriptions if the table exists (remote only)
-- SQLite does not support IF NOT EXISTS for ALTER TABLE; this is handled by migration guard
