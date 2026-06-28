-- Migration 0095: One-time password reset tokens + OAuth state store
-- Idempotent: uses CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS

-- Table: tracks consumed password reset JTIs to prevent replay attacks
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  used_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens(user_id, used_at);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires ON password_reset_tokens(expires_at);

-- Table: server-side OAuth state nonce store — keeps clientSecret out of URL
CREATE TABLE IF NOT EXISTS oauth_state_store (
  state_nonce TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  payload_encrypted TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE INDEX IF NOT EXISTS idx_oauth_state_expires ON oauth_state_store(expires_at);
