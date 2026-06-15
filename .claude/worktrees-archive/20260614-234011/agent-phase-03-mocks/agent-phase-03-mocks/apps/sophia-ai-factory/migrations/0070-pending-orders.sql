-- Migration 0070: pending_orders table for checkout intent tracking
-- Tracks checkout session from POST /api/checkout through IPN completion.
-- Enables status polling, idempotent order dedup, and audit trail.

CREATE TABLE IF NOT EXISTS pending_orders (
  order_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  payment_method TEXT NOT NULL DEFAULT 'nowpayments',
  amount_usd_cents INTEGER NOT NULL,
  promo_code TEXT,
  customer_email TEXT,
  invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_orders_user ON pending_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_pending_orders_payment_id ON pending_orders(payment_id);
