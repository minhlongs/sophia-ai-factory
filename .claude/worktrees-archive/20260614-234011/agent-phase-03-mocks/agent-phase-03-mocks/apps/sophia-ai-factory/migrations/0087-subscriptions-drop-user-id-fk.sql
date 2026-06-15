-- Migration 0087: Drop subscriptions.user_id FK (wrong table reference)
--
-- Migration 0086 added: ADD COLUMN user_id TEXT REFERENCES users(id);
-- BUT better-auth creates user records in `user` (singular), not `users` (plural).
-- Result: every INSERT into subscriptions with user_id fails FK constraint silently
--   → handover-account-setup throws → triggerAutoHandover returns null
--   → FREE100 redemption succeeds at promo step but no magic link generated.
--
-- Fix: recreate subscriptions without the wrong FK. Application logic ensures user exists
-- before insert; FK was a defensive add that introduced bugs.

PRAGMA foreign_keys = OFF;

CREATE TABLE subscriptions_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  polar_subscription_id TEXT,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  trial_ends_at INTEGER,
  user_id TEXT,
  tier TEXT
);

INSERT INTO subscriptions_new (id, org_id, polar_subscription_id, plan, status, current_period_start, current_period_end, created_at, updated_at, trial_ends_at, user_id, tier)
SELECT id, org_id, polar_subscription_id, plan, status, current_period_start, current_period_end, created_at, updated_at, trial_ends_at, user_id, tier FROM subscriptions;

DROP TABLE subscriptions;
ALTER TABLE subscriptions_new RENAME TO subscriptions;

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_tier_status_idx ON subscriptions(tier, status);
CREATE INDEX IF NOT EXISTS subscriptions_trial_ends_at_idx ON subscriptions(trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

PRAGMA foreign_keys = ON;
