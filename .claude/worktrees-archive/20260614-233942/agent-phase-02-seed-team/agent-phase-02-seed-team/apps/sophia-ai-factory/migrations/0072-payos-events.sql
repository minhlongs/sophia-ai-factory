-- Migration 0072: payos_events table for PayOS IPN tracking
-- Mirrors payment_events pattern for NOWPayments — same idempotency model.

CREATE TABLE IF NOT EXISTS payos_events (
  event_id TEXT PRIMARY KEY,
  order_code TEXT NOT NULL,
  status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  payload TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payos_events_order_code ON payos_events(order_code);
CREATE INDEX IF NOT EXISTS idx_payos_events_processed ON payos_events(processed);
