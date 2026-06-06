-- Add cash_payment columns to subscriptions (0173)
-- first_customer column was added by 0172-subscriptions-first-customer.sql
-- This migration adds the remaining cash payment tracking columns

ALTER TABLE subscriptions ADD COLUMN cash_payment INTEGER DEFAULT 0;

ALTER TABLE subscriptions ADD COLUMN cash_payment_note TEXT;

CREATE INDEX idx_subscriptions_cash_payment ON subscriptions(cash_payment);
