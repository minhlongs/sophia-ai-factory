-- 0178_referral_rewards_table.sql
-- Referral rewards ledger — prevents double-credit race conditions.
-- Security: UNIQUE(payment_id, referrer_id) guarantees each payment can only
-- reward a given referrer once, even if two IPN webhooks arrive concurrently.
-- Issue 2 fix: replaces read-modify-write on user_profiles.settings JSON blob.

CREATE TABLE IF NOT EXISTS referral_rewards (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES user(id),
  referred_user_id TEXT NOT NULL REFERENCES user(id),
  payment_id TEXT NOT NULL,
  reward_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(payment_id, referrer_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_payment ON referral_rewards(payment_id);
