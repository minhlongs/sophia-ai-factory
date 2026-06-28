-- Migration 0107: Telegram pairing tokens for web→bot account linking
-- Generated: 2026-05-12
-- Purpose: Single-use 32-char hex tokens, 1-hour TTL.
--   1. Welcome page generates token → t.me/Sophia_Bbot?start=<token>
--   2. Bot /start handler consumes token → links chat_id to user_id in telegram_paired_chats

CREATE TABLE IF NOT EXISTS telegram_pairing_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_telegram_pairing_tokens_user_id ON telegram_pairing_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_pairing_tokens_expires_at ON telegram_pairing_tokens (expires_at);
