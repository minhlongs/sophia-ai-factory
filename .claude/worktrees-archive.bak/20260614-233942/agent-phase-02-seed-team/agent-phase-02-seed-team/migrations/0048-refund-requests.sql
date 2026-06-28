-- Migration 0048: refund_requests table
-- Tracks customer refund requests for manual crypto refund workflow.

CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','refunded')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  reviewed_at INTEGER,
  reviewed_by_user_id TEXT,
  admin_notes TEXT,
  refund_tx_hash TEXT,
  customer_wallet_address TEXT
);

CREATE INDEX IF NOT EXISTS refund_requests_status_idx ON refund_requests(status, created_at);
CREATE INDEX IF NOT EXISTS refund_requests_user_idx ON refund_requests(user_id);
