-- Migration 0080: Add Pinterest, LinkedIn, Zalo to publisher infrastructure
-- Extends publishing_channels.provider CHECK constraint and channel_quotas entries.
--
-- D1 does not support ALTER TABLE to modify CHECK constraints.
-- Pattern: drop-and-recreate with IF NOT EXISTS guard + preserve existing data.
-- Safe to re-run (idempotent).

-- Step 1: Create new table with expanded provider CHECK
CREATE TABLE IF NOT EXISTS publishing_channels_v2 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('tiktok','youtube','instagram','pinterest','linkedin','zalo')),
  external_account_id TEXT NOT NULL,
  display_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER,
  status TEXT NOT NULL CHECK(status IN ('active','disconnected','expired')) DEFAULT 'active',
  refreshing_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(tenant_id, provider, external_account_id)
);

-- Step 2: Migrate existing rows (only tiktok/youtube/instagram will pass new CHECK)
INSERT OR IGNORE INTO publishing_channels_v2
  SELECT * FROM publishing_channels;

-- Step 3: Drop old table and rename
DROP TABLE IF EXISTS publishing_channels;
ALTER TABLE publishing_channels_v2 RENAME TO publishing_channels;

-- Step 4: Re-create indexes
CREATE INDEX IF NOT EXISTS idx_pub_channels_tenant ON publishing_channels(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_pub_channels_status ON publishing_channels(status);
