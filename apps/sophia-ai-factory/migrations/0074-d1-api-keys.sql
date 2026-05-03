-- Migration 0074: D1 raas_api_keys table (replaces Postgres-backed Supabase table)
-- Keys are sha256-hashed at rest; full key only returned at creation time.

CREATE TABLE IF NOT EXISTS raas_api_keys (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,        -- sha256(full_key) — NEVER store plaintext
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

CREATE INDEX IF NOT EXISTS idx_raas_api_keys_key_id
  ON raas_api_keys(key_id);

CREATE INDEX IF NOT EXISTS idx_raas_api_keys_owner
  ON raas_api_keys(owner_id);

CREATE INDEX IF NOT EXISTS idx_raas_api_keys_owner_active
  ON raas_api_keys(owner_id, key_id)
  WHERE revoked_at IS NULL;
