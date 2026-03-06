-- ROIaaS License Management Schema Migration
-- Migration: Redis → Supabase
-- Date: 2026-03-06
-- Description: Migrate license storage from Redis to Supabase for persistence and audit compliance

-- ============================================================================
-- Table: raas_licenses
-- Purpose: Store license key metadata (NOT the full key itself)
-- ============================================================================

CREATE TABLE IF NOT EXISTS raas_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL,              -- SHA256 hash of full license key (for lookup)
  tier TEXT NOT NULL,                   -- basic | premium | enterprise | master
  expires_at BIGINT,                    -- Unix timestamp (seconds) - 0 = perpetual
  nonce TEXT NOT NULL UNIQUE,           -- Random nonce from key (32 chars)
  is_revoked BOOLEAN DEFAULT false,     -- Revocation flag
  revoked_at BIGINT,                    -- Unix timestamp of revocation
  revoked_by UUID REFERENCES auth.users(id), -- User who revoked
  created_by UUID REFERENCES auth.users(id), -- Admin who created
  created_at BIGINT NOT NULL,           -- Unix timestamp (seconds)
  metadata JSONB DEFAULT '{}',          -- Additional metadata
  updated_at BIGINT                     -- Last update timestamp
);

-- ============================================================================
-- Table: raas_audit_logs
-- Purpose: Audit trail for all license operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS raas_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,                 -- CREATE | VALIDATE | REVOKE | UPDATE
  license_id UUID REFERENCES raas_licenses(id) ON DELETE SET NULL,
  license_nonce TEXT,                   -- Denormalized for faster queries
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,                      -- Client IP
  user_agent TEXT,                      -- Client user agent
  details JSONB DEFAULT '{}',           -- Action-specific details
  created_at BIGINT NOT NULL            -- Unix timestamp (seconds)
);

-- ============================================================================
-- Indexes: Performance optimization
-- ============================================================================

-- License lookups
CREATE INDEX IF NOT EXISTS idx_raas_licenses_key_hash ON raas_licenses(key_hash);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_nonce ON raas_licenses(nonce);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_tier ON raas_licenses(tier);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_created_by ON raas_licenses(created_by);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_is_revoked ON raas_licenses(is_revoked);

-- Audit log queries
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_license ON raas_audit_logs(license_id);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_license_nonce ON raas_audit_logs(license_nonce);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_user ON raas_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_action ON raas_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_created_at ON raas_audit_logs(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_raas_licenses_active ON raas_licenses(is_revoked, expires_at)
  WHERE is_revoked = false;

-- ============================================================================
-- RLS (Row Level Security) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE raas_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE raas_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything on raas_licenses
CREATE POLICY "Admins have full access to raas_licenses"
  ON raas_licenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Admins can do everything on raas_audit_logs
CREATE POLICY "Admins have full access to raas_audit_logs"
  ON raas_audit_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Users can view their own audit logs (SELECT only)
-- Enables users to fetch their own audit history via /api/user/audit-logs
-- Note: This policy is active - users have read access to their own logs
CREATE POLICY "Users can view own audit logs"
  ON raas_audit_logs
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    -- Allow service role (backend) to read all logs
    auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_raas_licenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at
CREATE TRIGGER tr_update_raas_licenses_timestamp
  BEFORE UPDATE ON raas_licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_raas_licenses_updated_at();

-- ============================================================================
-- Comments: Documentation
-- ============================================================================

COMMENT ON TABLE raas_licenses IS 'ROIaaS license key metadata - does NOT store full keys';
COMMENT ON COLUMN raas_licenses.key_hash IS 'SHA256 hash of full license key for secure lookup';
COMMENT ON COLUMN raas_licenses.nonce IS 'Random nonce component from license key (32 hex chars)';
COMMENT ON COLUMN raas_licenses.expires_at IS 'Unix timestamp in seconds; 0 = perpetual (master tier)';
COMMENT ON COLUMN raas_licenses.metadata IS 'JSONB for tier-specific custom fields';

COMMENT ON TABLE raas_audit_logs IS 'Audit trail for all license operations (CREATE, VALIDATE, REVOKE)';
COMMENT ON COLUMN raas_audit_logs.action IS 'Action type: CREATE, VALIDATE, REVOKE, UPDATE';
COMMENT ON COLUMN raas_audit_logs.details IS 'Action-specific data (e.g., validation count, revocation reason)';

-- ============================================================================
-- Initial Data: None (empty tables, data migrated from Redis)
-- ============================================================================

-- End of migration

