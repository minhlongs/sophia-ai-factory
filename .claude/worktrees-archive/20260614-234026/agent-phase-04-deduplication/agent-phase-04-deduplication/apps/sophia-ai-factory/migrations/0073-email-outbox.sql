-- Migration 0073: Welcome email outbox for durable delivery with retry
-- Replaces best-effort send in auto-handover.ts

CREATE TABLE IF NOT EXISTS welcome_email_outbox (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL UNIQUE,
  to_email TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'welcome-magic-link',
  payload TEXT NOT NULL,   -- JSON: {ownerFullName, tier, magicLinkUrl, locale}
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|sent|failed
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER NOT NULL,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_welcome_outbox_pending
  ON welcome_email_outbox(status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_welcome_outbox_payment
  ON welcome_email_outbox(payment_id);

-- Lifecycle email log: deduplicate D+1 and D+7 sends
CREATE TABLE IF NOT EXISTS lifecycle_email_log (
  user_id TEXT NOT NULL,
  template TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, template)
);
