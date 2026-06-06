-- Migration 0173: Add cash_payment columns to subscriptions
--
-- Idempotency: guarded by scripts/apply-migrations.sh (_migrations check).
-- Safe to re-run: ALTER TABLE errors on duplicate column are caught by the
-- pre-flight check before this file is executed.

ALTER TABLE subscriptions ADD COLUMN cash_payment INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN cash_payment_note TEXT;
CREATE INDEX IF NOT EXISTS idx_subscriptions_cash_payment ON subscriptions(cash_payment);
