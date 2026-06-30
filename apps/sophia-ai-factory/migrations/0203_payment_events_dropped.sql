-- Migration 0203: payment_events_dropped table
-- Records IPN events dropped when DLQ is at capacity (DLQ_SIZE_CAP=1000).
-- Enables admin reconciliation and replay of dropped events.

CREATE TABLE IF NOT EXISTS payment_events_dropped (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  order_id TEXT DEFAULT '',
  payload TEXT DEFAULT '{}',
  failure_reason TEXT DEFAULT '',
  dlq_size_at_drop INTEGER NOT NULL,
  dropped_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_events_dropped_payment
  ON payment_events_dropped(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_dropped_at
  ON payment_events_dropped(dropped_at);

CREATE INDEX IF NOT EXISTS idx_payment_events_dropped_event_id
  ON payment_events_dropped(event_id);
