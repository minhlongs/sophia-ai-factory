-- Migration 0207: Overage Top-Up tables
-- Supports the top-up flow for overage billing:
--   pending_topups: tracks invoices awaiting IPN confirmation
--   topup_events: audit trail for top-up lifecycle events
--
-- Credit grant uses the existing user_credits table (upsert pattern).
-- Atomic lock for IPN dedup uses the existing payment_events table.

CREATE TABLE IF NOT EXISTS pending_topups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL UNIQUE,
  mcu_amount INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pending_topups_user
  ON pending_topups(user_id);

CREATE INDEX IF NOT EXISTS idx_pending_topups_invoice
  ON pending_topups(invoice_id);

CREATE TABLE IF NOT EXISTS topup_events (
  event_id TEXT PRIMARY KEY,
  topup_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_topup_events_topup_id
  ON topup_events(topup_id);
