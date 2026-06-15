-- Telegram DM pairing tables
-- Paired chats: approved senders allowed to use the bot
CREATE TABLE IF NOT EXISTS telegram_paired_chats (
  chat_id TEXT PRIMARY KEY,
  first_name TEXT,
  paired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paired_by TEXT NOT NULL
);

-- Pending pairing requests: unverified senders awaiting admin approval
CREATE TABLE IF NOT EXISTS telegram_pending_pairing (
  chat_id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_code ON telegram_pending_pairing(code);
