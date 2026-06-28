-- Phase BYOK-Refactor: per-user provider credentials table.
--
-- Stores customer-provided HeyGen / Resend / NOWPayments keys encrypted
-- at rest with AES-GCM-256 keyed by BYOK_MASTER_KEY env (same key as
-- user_api_keys -- one master key for all per-user secrets).
--
-- Distinct from user_api_keys (which stores LLM / media-gen BYOK keys).
-- This table targets fulfillment providers the customer MUST supply to
-- use video generation and transactional email under their own accounts.
--
-- Format: encrypted_value = <iv_b64>:<ciphertext_b64>
-- display_hint: last 4 chars of plaintext key (e.g. "...XYZ9") for UI
-- status: 'active' | 'disabled' | 'revoked'
-- UNIQUE (user_id, provider) -- one key per user per provider

CREATE TABLE IF NOT EXISTS user_provider_credentials (
  id              TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id         TEXT    NOT NULL,
  provider        TEXT    NOT NULL,
  encrypted_value TEXT    NOT NULL,
  display_hint    TEXT,
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  last_used_at    INTEGER,
  status          TEXT    NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'disabled', 'revoked')),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS user_provider_credentials_user_idx
  ON user_provider_credentials(user_id);
