-- Migration 0206: Commission events table + commission dead-letter queue
--
-- commission_events: Atomic lock table for idempotent ClickBank INS postback processing.
--   event_id format: clickbank_{receipt}_{transactionType}
--   Same INSERT ON CONFLICT DO NOTHING pattern as payment_events.
--
-- commission_dead_letter: Captures commission ledger writes that fail permanently.
--   Same DLQ pattern as ipn_dead_letter_queue.

-- Commission events (idempotency lock)
CREATE TABLE IF NOT EXISTS commission_events (
  event_id    TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,
  payload     TEXT,
  processed   INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commission_events_processed
  ON commission_events(processed);

-- Commission dead-letter queue
CREATE TABLE IF NOT EXISTS commission_dead_letter (
  event_id          TEXT PRIMARY KEY,
  receipt           TEXT NOT NULL,
  transaction_type  TEXT NOT NULL,
  amount            REAL NOT NULL,
  payload           TEXT NOT NULL DEFAULT '',
  failure_reason    TEXT NOT NULL DEFAULT '',
  retry_count       INTEGER NOT NULL DEFAULT 0,
  first_failed_at   TEXT NOT NULL,
  last_attempted_at TEXT NOT NULL,
  resolved          INTEGER NOT NULL DEFAULT 0,
  resolved_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_commission_dlq_unresolved
  ON commission_dead_letter(resolved, last_attempted_at);
