-- Phase 4G-BYOK: per-user API keys table.
--
-- Stores user-provided provider API keys (OpenRouter, Anthropic, etc.)
-- encrypted at rest with AES-GCM-256 keyed by BYOK_MASTER_KEY env.
--
-- PRIMARY KEY (user_id, provider) enforces single key per user+provider.
-- `encrypted_key` BLOB = [iv(12 bytes)][ciphertext+authTag]; decryption
-- is app-side via src/lib/byok/byok-crypto.ts.
--
-- Providers (currently supported, not enum-locked in DB):
--   openrouter, anthropic, elevenlabs, d-id
--
-- Opt-in: caller must lookup via resolveUserApiKey(userId, provider)
-- with BYOK_ENABLED=1. Rows can exist without being consumed (inert).

CREATE TABLE IF NOT EXISTS user_api_keys (
  user_id       TEXT NOT NULL,
  provider      TEXT NOT NULL,
  encrypted_key BLOB NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, provider)
);

-- Fast listing of all keys held by a user (for /dashboard/api-keys UI later).
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user
  ON user_api_keys(user_id);
