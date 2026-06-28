-- RaaS API Keys Table for Audit API Authentication
-- Created: 2026-03-08
-- Purpose: Store mk_ API keys for /api/audit endpoint dual authentication

-- Create API keys table if not exists
CREATE TABLE IF NOT EXISTS raas_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id TEXT UNIQUE NOT NULL,
  key_hash TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  rate_limit_per_min INT DEFAULT 100
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_key_id ON raas_api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_owner_id ON raas_api_keys(owner_id);
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_expires_at ON raas_api_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_revoked_at ON raas_api_keys(revoked_at) WHERE revoked_at IS NOT NULL;

-- Comment for documentation
COMMENT ON TABLE raas_api_keys IS 'RaaS API keys for audit API dual authentication (JWT + API key)';
COMMENT ON COLUMN raas_api_keys.key_id IS 'Unique key identifier (16 hex chars)';
COMMENT ON COLUMN raas_api_keys.key_hash IS 'HMAC-SHA256 hash of full API key for storage';
COMMENT ON COLUMN raas_api_keys.owner_id IS 'User ID who owns this API key';
COMMENT ON COLUMN raas_api_keys.permissions IS 'Array of permissions: audit:read, audit:write, reports:download, etc.';
COMMENT ON COLUMN raas_api_keys.expires_at IS 'Optional expiration timestamp (Unix seconds)';
COMMENT ON COLUMN raas_api_keys.revoked_at IS 'Timestamp when key was revoked (soft delete)';
COMMENT ON COLUMN raas_api_keys.last_used_at IS 'Last time this key was used for authentication';
COMMENT ON COLUMN raas_api_keys.rate_limit_per_min IS 'Rate limit in requests per minute (default 100)';

-- RLS (Row Level Security) policies
ALTER TABLE raas_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own API keys
CREATE POLICY "Users can view own API keys"
  ON raas_api_keys
  FOR SELECT
  USING (auth.uid()::text = owner_id);

-- Policy: Users can create API keys for themselves
CREATE POLICY "Users can create own API keys"
  ON raas_api_keys
  FOR INSERT
  WITH CHECK (auth.uid()::text = owner_id);

-- Policy: Users can revoke their own API keys
CREATE POLICY "Users can revoke own API keys"
  ON raas_api_keys
  FOR UPDATE
  USING (auth.uid()::text = owner_id);

-- Policy: Admins can manage all API keys (using a simple check - adjust based on your admin system)
CREATE POLICY "Admins can manage all API keys"
  ON raas_api_keys
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()::text
      AND user_profiles.subscription_tier IN ('enterprise', 'master')
    )
  );
