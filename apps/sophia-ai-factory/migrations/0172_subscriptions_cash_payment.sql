-- Add cash_payment flag to subscriptions table
-- Allows operator to mark a subscription as paid via offline/cash method
-- This is the "first customer" exception to the automated payment flow

-- SQLite-compatible: no IF NOT EXISTS in ALTER TABLE
ALTER TABLE subscriptions ADD COLUMN cash_payment INTEGER DEFAULT 0;

-- SQLite-compatible: no partial index WHERE clause
ALTER TABLE subscriptions ADD COLUMN cash_payment_note TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_cash_payment ON subscriptions(cash_payment);
