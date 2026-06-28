-- Violations Table Schema
-- Stores quota enforcement violations for analytics dashboard
-- Part of Phase 6 - Advanced Compliance & Enforcement

-- Create violations table
CREATE TABLE IF NOT EXISTS violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar NOT NULL CHECK (type IN (
    'quota_exceeded',
    'invalid_license',
    'expired_license',
    'revoked_license',
    'rate_limit_exceeded',
    'unauthorized_access',
    'cross_tenant_access'
  )),
  severity varchar NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  license_nonce varchar NOT NULL,
  tier varchar NOT NULL CHECK (tier IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER')),
  endpoint varchar NOT NULL,
  ip_address varchar,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS violations_license_nonce_idx ON violations(license_nonce);
CREATE INDEX IF NOT EXISTS violations_user_id_idx ON violations(user_id);
CREATE INDEX IF NOT EXISTS violations_type_idx ON violations(type);
CREATE INDEX IF NOT EXISTS violations_severity_idx ON violations(severity);
CREATE INDEX IF NOT EXISTS violations_created_at_idx ON violations(created_at);
CREATE INDEX IF NOT EXISTS violations_resolved_idx ON violations(resolved);
CREATE INDEX IF NOT EXISTS violations_license_type_resolved_idx ON violations(license_nonce, type, resolved, created_at);

-- Enable Row Level Security
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- 1. Admin users can see all violations
CREATE POLICY violations_admin_select ON violations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- 2. Users can only see their own violations
CREATE POLICY violations_user_select ON violations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. Admin users can resolve violations
CREATE POLICY violations_admin_update ON violations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Add unique constraint to prevent duplicate violations in same second
ALTER TABLE violations ADD CONSTRAINT violations_license_type_time_unique
  UNIQUE (license_nonce, type, created_at);

-- Comment
COMMENT ON TABLE violations IS 'Stores quota enforcement violations for RaaS Gateway Audit API (Phase 6)';
COMMENT ON COLUMN violations.type IS 'Type of violation: quota_exceeded, invalid_license, etc.';
COMMENT ON COLUMN violations.severity IS 'Severity level: low, medium, high, critical';
COMMENT ON COLUMN violations.metadata IS 'Additional violation metadata (JSONB)';
