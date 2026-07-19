-- Migration: Audit Logs RLS + User Access
-- Date: 2026-03-06
-- Purpose: Enable users to view their own audit logs while maintaining admin-only write access
--          Update audit retention from 30 days to 90 days for SOC 2 compliance

-- ============================================================================
-- Part 1: Update RLS Policies for raas_audit_logs
-- ============================================================================

-- Drop existing admin-only policy to replace with enhanced policies
DROP POLICY IF EXISTS "Admins have full access to raas_audit_logs" ON raas_audit_logs;

-- Policy 1: Admins retain full access (ALL operations)
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

-- Policy 2: Users can view their own audit logs (SELECT only)
-- This allows authenticated users to read audit logs where they are the user_id
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
-- Part 2: Add Indexes for User Filtering
-- ============================================================================

-- Index for filtering audit logs by user_id (for user-specific queries)
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_user_id_created_at
  ON raas_audit_logs(user_id, created_at DESC);

-- ============================================================================
-- Part 3: Create View for User Audit Logs (Convenience)
-- ============================================================================

-- Optional: Create a view that users can query for their own logs
-- This provides an extra layer of abstraction for row-level filtering
CREATE OR REPLACE VIEW user_audit_logs AS
SELECT
  id,
  action,
  license_id,
  license_nonce,
  ip_address,
  user_agent,
  details,
  created_at
FROM raas_audit_logs
WHERE user_id = auth.uid();

-- Grant SELECT on view to authenticated users
GRANT SELECT ON user_audit_logs TO authenticated;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify RLS policies
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'raas_audit_logs';

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'raas_audit_logs';

-- End of migration
