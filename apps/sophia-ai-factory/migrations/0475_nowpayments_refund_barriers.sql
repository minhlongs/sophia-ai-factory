-- Persistent refund tombstones prevent a late NOWPayments `finished` IPN from
-- creating or restoring access after a refund was received.
CREATE TABLE IF NOT EXISTS nowpayments_refund_barriers (
  payment_id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
