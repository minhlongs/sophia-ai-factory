-- Migration 0208: Refund events (atomic lock) and refund ledger
-- Supports the admin-driven refund processing pipeline:
--   refund_events: atomic lock table (INSERT ON CONFLICT DO NOTHING)
--   refund_ledger: financial audit trail for all refunds

CREATE TABLE IF NOT EXISTS refund_events (
  event_id TEXT PRIMARY KEY,
  refund_request_id TEXT NOT NULL,
  refund_type TEXT NOT NULL DEFAULT 'manual',
  payload TEXT,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_refund_events_request_id
  ON refund_events(refund_request_id);

CREATE INDEX IF NOT EXISTS idx_refund_events_processed
  ON refund_events(processed, created_at);

CREATE TABLE IF NOT EXISTS refund_ledger (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  refund_request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  tier_before TEXT NOT NULL DEFAULT 'BASIC',
  tier_after TEXT NOT NULL DEFAULT 'BASIC',
  mcu_clawed_back INTEGER NOT NULL DEFAULT 0,
  tx_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_refund_ledger_request_id
  ON refund_ledger(refund_request_id);

CREATE INDEX IF NOT EXISTS idx_refund_ledger_user_id
  ON refund_ledger(user_id);
