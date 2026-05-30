-- Migration 0086: Add user_id + tier columns to subscriptions
--
-- Schema drift fix: code (handover-account-setup.ts, promo-repo.ts) writes
-- user_id/tier but migration 0001 only declared org_id/plan. Without these:
--   - FREE100 redeem → handover-account-setup INSERT crashes silently
--   - getUserTier() can't resolve tier for users without org (FREE100 path)
--
-- Already applied to remote D1 on 2026-05-04. trial_ends_at was added by an
-- earlier guarded migration (0066 comment), so it's not included here.
-- Backwards-compatible: new columns NULLABLE. Existing org-scoped rows untouched.
--
-- For customer-scoped subscriptions (FREE100 etc.), code MUST still pass a
-- non-null org_id (subscriptions.org_id retains NOT NULL). Helper
-- `ensureCustomerOrg(userId, email)` in handover-account-setup creates a
-- 1-member sentinel org so existing FK + NOT NULL constraints hold.

ALTER TABLE subscriptions ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE subscriptions ADD COLUMN tier TEXT;
ALTER TABLE subscriptions ADD COLUMN trial_ends_at INTEGER;

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_tier_status_idx ON subscriptions(tier, status);
