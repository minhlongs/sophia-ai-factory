-- Migration 0094: Add threads, reddit, bluesky, mastodon to publishing_channels.provider CHECK
-- D1/SQLite cannot ALTER CHECK; recreate table with broader constraint.
-- NOT idempotent on re-run: DROP+RENAME succeeds only when *_new exists.
-- Driven via apply-migrations.sh git-diff guard so re-application is gated externally.

-- Step 1: Create new table with extended CHECK (adds threads, reddit, bluesky, mastodon)
CREATE TABLE IF NOT EXISTS publishing_channels_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN (
    'tiktok','youtube','instagram','pinterest','linkedin','zalo',
    'facebook','twitter','threads','reddit','bluesky','mastodon'
  )),
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

-- Step 2: Copy existing data (all providers including old ones)
INSERT OR IGNORE INTO publishing_channels_new
SELECT id, tenant_id, user_id, provider, external_account_id, display_name,
       access_token, refresh_token, expires_at, status, refreshing_at,
       created_at, updated_at
FROM publishing_channels;

-- Step 3: Swap tables
DROP TABLE publishing_channels;
ALTER TABLE publishing_channels_new RENAME TO publishing_channels;

-- Step 4: Re-create indexes
CREATE INDEX IF NOT EXISTS idx_pub_channels_tenant ON publishing_channels(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_pub_channels_status ON publishing_channels(status);
