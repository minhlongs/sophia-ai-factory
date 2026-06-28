-- Migration: Telegram pairing tokens for web→bot account linking
-- Date: 2026-05-12
-- Purpose: Stores short-lived tokens generated on the welcome page.
--          User clicks "Connect Telegram" → token generated → opens t.me/Sophia_Bbot?start=<token>
--          Bot /start <token> handler looks up token, links chat_id to user_id.

CREATE TABLE IF NOT EXISTS telegram_pairing_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_telegram_pairing_tokens_user_id ON telegram_pairing_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_pairing_tokens_expires_at ON telegram_pairing_tokens (expires_at);
