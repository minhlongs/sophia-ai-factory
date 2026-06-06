-- Add first_customer flag to subscriptions table
-- Allows operator to mark a subscription as paid via offline/cash method
-- This is the "first customer" exception to the automated payment flow

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cash_payment INTEGER DEFAULT 0;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cash_payment_note TEXT;

-- Index for finding first-customer subscriptions quickly
CREATE INDEX IF NOT EXISTS idx_subscriptions_cash_payment
  ON subscriptions(cash_payment)
  WHERE cash_payment = 1;
