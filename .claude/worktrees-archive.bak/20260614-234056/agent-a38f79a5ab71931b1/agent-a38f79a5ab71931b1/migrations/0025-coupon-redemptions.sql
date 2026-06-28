-- Migration 0025: Coupon redemptions table
-- Tracks per-user coupon usage to prevent reuse and enforce maxUses.

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redeemed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, coupon_code)
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_code ON coupon_redemptions(coupon_code);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(user_id);
