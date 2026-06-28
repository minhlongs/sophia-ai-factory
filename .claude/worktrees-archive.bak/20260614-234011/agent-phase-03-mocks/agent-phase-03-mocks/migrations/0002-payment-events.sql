-- Payment events for IPN idempotency tracking (NOWPayments)
CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT DEFAULT '{}',
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_events_event_id ON payment_events(event_id);
