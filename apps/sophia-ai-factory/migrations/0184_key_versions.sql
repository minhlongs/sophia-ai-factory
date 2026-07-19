-- Migration 0184: Key versioning infrastructure for BYOK credential rotation.
-- Phase: 4 - Key Rotation Infrastructure
--
-- Adds:
--   1. key_versions table — tracks each master key version with lifecycle metadata
--   2. key_version column on user_api_keys — links stored key to the version that encrypted it
--   3. key_version column on user_provider_credentials — same for provider credentials
--   4. key_version column on platform_credentials — same for platform OAuth tokens
--
-- Dual-decrypt window: when a key is rotated, the previous version stays valid for 24h.
-- Application code (byok-crypto.ts) loads both current + previous versions during that
-- window so existing credentials remain readable until the re-encrypt job completes.

-- 1. key_versions table
CREATE TABLE IF NOT EXISTS key_versions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  key_type    TEXT NOT NULL,                          -- 'master' | 'credential' | 'platform'
  version     INTEGER NOT NULL,                       -- monotonically increasing per key_type
  encrypted_key TEXT NOT NULL,                        -- the new master key material, encrypted at rest
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  rotated_at  TEXT,                                   -- NULL until rotation supersedes it
  rotated_by  TEXT,                                   -- admin user id who triggered rotation
  is_active   INTEGER NOT NULL DEFAULT 1,             -- 1 = current, 0 = retired
  UNIQUE(key_type, version)
);

CREATE INDEX IF NOT EXISTS idx_key_versions_type_active
  ON key_versions(key_type, is_active);
CREATE INDEX IF NOT EXISTS idx_key_versions_created
  ON key_versions(created_at);

-- 2. key_version column on user_api_keys (BYOK Phase 4G)
ALTER TABLE user_api_keys
  ADD COLUMN key_version INTEGER DEFAULT 1;

-- 3. key_version column on user_provider_credentials (BYOK Phase BYOK-Refactor)
ALTER TABLE user_provider_credentials
  ADD COLUMN key_version INTEGER DEFAULT 1;

-- 4. key_version column on platform_credentials (multi-channel publishing)
ALTER TABLE platform_credentials
  ADD COLUMN key_version INTEGER DEFAULT 1;
