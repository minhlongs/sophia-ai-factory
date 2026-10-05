-- Migration: Create raas_api_keys table
-- Date: 2026-03-08
-- Purpose: Store API keys for RaaS Gateway Audit API access

CREATE TABLE IF NOT EXISTS raas_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id VARCHAR(16) NOT NULL UNIQUE,
    key_hash VARCHAR(64) NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    rate_limit_per_min INTEGER NOT NULL DEFAULT 100,
    CONSTRAINT raas_api_keys_key_id_length CHECK (LENGTH(key_id) = 16),
    CONSTRAINT raas_api_keys_key_hash_length CHECK (LENGTH(key_hash) = 64),
    CONSTRAINT raas_api_keys_rate_limit_positive CHECK (rate_limit_per_min > 0)
);

-- Index for fast lookups by key_id
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_key_id ON raas_api_keys(key_id);

-- Index for owner lookups
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_owner_id ON raas_api_keys(owner_id);

-- Index for active keys (not expired, not revoked)
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_active
    ON raas_api_keys(owner_id, key_id)
    WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW());

-- RLS (Row Level Security) policies
ALTER TABLE raas_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own API keys
CREATE POLICY "Users can view own API keys"
    ON raas_api_keys
    FOR SELECT
    USING (owner_id = auth.uid());

-- Policy: Users can create their own API keys
CREATE POLICY "Users can create own API keys"
    ON raas_api_keys
    FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Policy: Users can revoke their own API keys
CREATE POLICY "Users can update own API keys"
    ON raas_api_keys
    FOR UPDATE
    USING (owner_id = auth.uid());

-- Policy: Users can delete their own API keys
CREATE POLICY "Users can delete own API keys"
    ON raas_api_keys
    FOR DELETE
    USING (owner_id = auth.uid());

-- Policy: Admins can manage all API keys (using auth role check)
CREATE POLICY "Admins can manage all API keys"
    ON raas_api_keys
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Comment for documentation
COMMENT ON TABLE raas_api_keys IS 'Stores API keys for RaaS Gateway Audit API access with HMAC-SHA256 signatures';
COMMENT ON COLUMN raas_api_keys.key_id IS '16-character hex key ID (public identifier)';
COMMENT ON COLUMN raas_api_keys.key_hash IS 'SHA-256 hash of the full API key (never store plain key)';
COMMENT ON COLUMN raas_api_keys.permissions IS 'JSON array of permission strings (e.g., ["audit:read", "audit:write"])';
COMMENT ON COLUMN raas_api_keys.revoked_at IS 'Timestamp when key was revoked (soft delete)';
COMMENT ON COLUMN raas_api_keys.last_used_at IS 'Timestamp of last successful API key usage';
