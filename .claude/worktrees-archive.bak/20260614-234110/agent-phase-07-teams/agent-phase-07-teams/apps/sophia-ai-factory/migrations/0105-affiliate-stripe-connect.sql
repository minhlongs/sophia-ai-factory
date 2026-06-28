-- Migration 0105: Stripe Connect Express linkage — self-contained CREATE.
--
-- Why CREATE instead of ALTER:
--   Remote D1 diverged from migration 0023's `user_payout_settings` schema (table
--   was never applied — affiliate_payouts is the org-level table that exists instead).
--   Original 0105 used ALTER which fails on remote with "no such table".
--   This rewrite creates the table from scratch with the FULL superset of columns
--   (original 0023 layout + 5 Stripe Connect cols), guarded by IF NOT EXISTS so it
--   is idempotent on local D1 dev environments where 0023 may have been applied.
--
-- Design notes:
--   - `preferred_method` CHECK enum kept identical to 0023 — adding 'stripe_connect'
--     would silently lock out the method until a constraint rewrite, so Stripe is
--     tracked via the dedicated `stripe_*` columns instead (orthogonal to
--     preferred_method which still routes USDT/bank).
--   - `stripe_connect_events` is the webhook idempotency log (event.id is unique
--     per Stripe webhook docs).

CREATE TABLE IF NOT EXISTS user_payout_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  preferred_method TEXT CHECK (preferred_method IN ('usdt_trc20','usdt_erc20','bank_transfer')),
  payout_address TEXT,                     -- crypto wallet OR bank account; encrypt before WRITE (TODO M+1)
  payout_address_verified INTEGER DEFAULT 0,
  -- Stripe Connect Express columns (Phase 03)
  stripe_account_id TEXT,
  stripe_account_status TEXT,              -- 'pending' | 'enabled' | 'restricted' | 'rejected'
  stripe_payout_enabled INTEGER DEFAULT 0, -- 1 once charges_enabled+payouts_enabled
  stripe_onboarding_started_at TEXT,
  stripe_last_event_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

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
