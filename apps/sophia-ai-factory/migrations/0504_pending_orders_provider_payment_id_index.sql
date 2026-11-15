-- 0504_pending_orders_provider_payment_id_index.sql
-- Ensures partial lookup index on pending_orders(provider_payment_id) exists idempotently
-- for PayOS IPN webhook correlation.

CREATE INDEX IF NOT EXISTS idx_pending_orders_provider_payment_id
  ON pending_orders(provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
