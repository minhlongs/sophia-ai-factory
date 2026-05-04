-- Migration 0083: Add Pinterest, LinkedIn, Zalo to publisher infrastructure
-- Creates publishing_channels with expanded provider CHECK to support new publishers.
--
-- Since this is the first migration creating this table, we directly create it
-- with all providers. If the table already exists (from prior migrations),
-- this is idempotent via IF NOT EXISTS.
-- Safe to re-run (idempotent).

-- Step 1: Create publishing_channels table with all provider support
CREATE TABLE IF NOT EXISTS publishing_channels (
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

-- Step 2: Re-create indexes
CREATE INDEX IF NOT EXISTS idx_pub_channels_tenant ON publishing_channels(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_pub_channels_status ON publishing_channels(status);
