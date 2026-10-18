-- Preserve the VND invoice amount so PayOS webhooks validate against the issued link,
-- even if tier pricing or USD_TO_VND changes before the customer pays.
ALTER TABLE pending_orders ADD COLUMN amount_vnd INTEGER;
