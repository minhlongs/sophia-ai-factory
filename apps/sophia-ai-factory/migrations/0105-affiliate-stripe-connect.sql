-- Migration 0105: Stripe Connect Express linkage on user_payout_settings.
-- Adds columns needed to (a) onboard an affiliate via Stripe Connect Account Link,
-- (b) track KYC/charges_enabled state from account.updated webhooks, and
-- (c) split outbound payouts between USDT (existing) and fiat (Stripe Transfer).
--
-- Design notes:
--   - Does NOT alter the `preferred_method` CHECK enum on user_payout_settings
--     (SQLite cannot alter CHECK in place; we keep stripe_connect orthogonal).
--   - Does NOT alter `payouts.method` CHECK either; Stripe transfers will write
--     method='other' with reference=<stripe_transfer_id> until a future migration
--     widens the enum.
--   - All new columns are NULL/0-default safe → backwards compatible.

ALTER TABLE user_payout_settings ADD COLUMN stripe_account_id TEXT;
ALTER TABLE user_payout_settings ADD COLUMN stripe_account_status TEXT;       -- 'pending' | 'enabled' | 'restricted' | 'rejected'
ALTER TABLE user_payout_settings ADD COLUMN stripe_payout_enabled INTEGER DEFAULT 0;  -- 1 once charges_enabled+payouts_enabled
ALTER TABLE user_payout_settings ADD COLUMN stripe_onboarding_started_at TEXT;
ALTER TABLE user_payout_settings ADD COLUMN stripe_last_event_at TEXT;

CREATE INDEX IF NOT EXISTS idx_payout_settings_stripe_acct
  ON user_payout_settings(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- Idempotency log for Stripe webhook events (event.id is unique per Stripe doc).
CREATE TABLE IF NOT EXISTS stripe_connect_events (
  event_id TEXT PRIMARY KEY,            -- Stripe event.id (e.g. evt_1AbC2dE...)
  event_type TEXT NOT NULL,             -- e.g. 'account.updated'
  account_id TEXT,                      -- Stripe acct_... (nullable for non-account events)
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_account
  ON stripe_connect_events(account_id, received_at DESC)
  WHERE account_id IS NOT NULL;
