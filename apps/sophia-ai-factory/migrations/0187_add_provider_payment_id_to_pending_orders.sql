-- Add provider_payment_id to pending_orders for PayOS webhook correlation
-- GO LIVE requirement: ensures PayOS paymentLinkId can be matched idempotently

ALTER TABLE pending_orders ADD COLUMN provider_payment_id TEXT;

-- Index for fast lookup by provider payment ID (used by PayOS IPN webhook)
CREATE INDEX idx_pending_orders_provider_payment_id ON pending_orders(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
