-- Migration 0076: User-scoped API keys table (renamed from raas_api_keys to avoid conflict
-- with existing org-scoped raas_api_keys on PROD which has 10 production rows).
-- This is the "v2" of GAP3 phase-04 — schema is identical to original 0074 but with
-- a unique table name `raas_user_api_keys` so it doesn't collide with the legacy table.

CREATE TABLE IF NOT EXISTS raas_user_api_keys (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]',
  rate_limit_per_min INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER,
  last_used_at INTEGER,
  FOREIGN KEY (owner_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_raas_user_api_keys_key_id
  ON raas_user_api_keys(key_id);

CREATE INDEX IF NOT EXISTS idx_raas_user_api_keys_owner
  ON raas_user_api_keys(owner_id);

CREATE INDEX IF NOT EXISTS idx_raas_user_api_keys_owner_active
  ON raas_user_api_keys(owner_id, key_id)
  WHERE revoked_at IS NULL;
