-- Correlate PayOS Quote-to-Cash payments without routing them through SaaS tiers.
ALTER TABLE pending_orders ADD COLUMN purpose TEXT NOT NULL DEFAULT 'subscription';
ALTER TABLE pending_orders ADD COLUMN contract_id TEXT;
ALTER TABLE pending_orders ADD COLUMN invoice_id TEXT;
ALTER TABLE pending_orders ADD COLUMN provider_order_code INTEGER;

CREATE INDEX IF NOT EXISTS idx_pending_orders_contract
  ON pending_orders(contract_id, invoice_id) WHERE purpose = 'contract';
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_orders_provider_order_code
  ON pending_orders(provider_order_code) WHERE provider_order_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_orders_one_pending_contract_checkout
  ON pending_orders(contract_id)
  WHERE purpose = 'contract' AND status = 'pending' AND contract_id IS NOT NULL;

-- Stable idempotency key for payment-backed MCU ledger entries.
ALTER TABLE mcu_transactions ADD COLUMN payment_reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mcu_transactions_payment_reference
  ON mcu_transactions(payment_reference) WHERE payment_reference IS NOT NULL;
