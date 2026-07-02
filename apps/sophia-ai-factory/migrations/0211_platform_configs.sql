-- Migration 0211: Platform configs table for BYOK-style settings
--
-- Stores platform-level configuration values (e.g. Honeycomb API key)
-- that are encrypted at rest and manageable through admin UI.
-- This lets operators/CEOs self-serve observability setup without wrangler CLI.

CREATE TABLE IF NOT EXISTS platform_configs (
  key TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_platform_configs_updated ON platform_configs(updated_at);

-- Verify
SELECT '0211: OK' AS migration_status FROM platform_configs LIMIT 1;
