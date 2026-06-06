-- Migration 0173: Add cash_payment columns to subscriptions
--
-- IMPORTANT: D1 migrations are run-once (tracked in the _migrations table).
-- If re-running is needed, use `bash scripts/apply-migrations.sh` which
-- checks _migrations before executing. Manually re-running this file
-- will error on duplicate column/index.
--
-- Guard pattern: check PRAGMA before ALTER to allow safe re-runs in dev.

-- Add cash_payment INTEGER column if not present
SELECT CASE
  WHEN COUNT(*) = 0 THEN (
    ALTER TABLE subscriptions ADD COLUMN cash_payment INTEGER DEFAULT 0
  )
END FROM pragma_table_info('subscriptions') WHERE name = 'cash_payment';

-- Add cash_payment_note TEXT column if not present
SELECT CASE
  WHEN COUNT(*) = 0 THEN (
    ALTER TABLE subscriptions ADD COLUMN cash_payment_note TEXT
  )
END FROM pragma_table_info('subscriptions') WHERE name = 'cash_payment_note';

-- Create index if not present
CREATE INDEX IF NOT EXISTS idx_subscriptions_cash_payment ON subscriptions(cash_payment);
