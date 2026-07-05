CREATE TABLE IF NOT EXISTS ipn_dead_letter_queue (
  event_id TEXT NOT NULL PRIMARY KEY,
  payment_id TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  order_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  failure_reason TEXT NOT NULL DEFAULT '',
  retry_count INTEGER NOT NULL DEFAULT 0,
  first_failed_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dlq_event_id ON ipn_dead_letter_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_dlq_unresolved ON ipn_dead_letter_queue(resolved, last_attempted_at) WHERE resolved = 0;
