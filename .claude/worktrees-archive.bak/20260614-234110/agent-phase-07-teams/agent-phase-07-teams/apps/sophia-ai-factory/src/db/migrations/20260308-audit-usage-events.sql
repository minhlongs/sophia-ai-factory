-- ROIaaS Compliance Audit - Usage Events Capture
-- Migration: Add model invocation tracking to raas_audit_logs
-- Date: 2026-03-08
-- Description: Track model invocations, token counts, and GDPR-compliant user identifiers

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

-- 1. Add model invocation tracking columns
ALTER TABLE raas_audit_logs
  ADD COLUMN IF NOT EXISTS model_name TEXT,
  ADD COLUMN IF NOT EXISTS token_count INTEGER,
  ADD COLUMN IF NOT EXISTS ip_address_hash TEXT,
  ADD COLUMN IF NOT EXISTS user_pseudonym TEXT;

-- 2. Create indexes for GDPR queries and analytics
CREATE INDEX IF NOT EXISTS idx_audit_logs_model_name
  ON raas_audit_logs(model_name) WHERE model_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_hash
  ON raas_audit_logs(ip_address_hash);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_pseudonym
  ON raas_audit_logs(user_pseudonym);

-- 3. Add comments for documentation
COMMENT ON COLUMN raas_audit_logs.model_name IS 'AI model name for usage tracking (e.g., gpt-4, claude-3)';
COMMENT ON COLUMN raas_audit_logs.token_count IS 'Total tokens consumed (input + output)';
COMMENT ON COLUMN raas_audit_logs.ip_address_hash IS 'SHA-256 hash of IP address (GDPR-compliant)';
COMMENT ON COLUMN raas_audit_logs.user_pseudonym IS 'SHA-256 pseudonym of user_id (GDPR-compliant analytics)';

-- ============================================================================
-- DOWN MIGRATION (Rollback)
-- ============================================================================

-- To rollback, execute these in order:
-- DROP INDEX IF EXISTS idx_audit_logs_user_pseudonym;
-- DROP INDEX IF EXISTS idx_audit_logs_ip_hash;
-- DROP INDEX IF EXISTS idx_audit_logs_model_name;
-- ALTER TABLE raas_audit_logs DROP COLUMN IF EXISTS model_name;
-- ALTER TABLE raas_audit_logs DROP COLUMN IF NOT EXISTS token_count;
-- ALTER TABLE raas_audit_logs DROP COLUMN IF NOT EXISTS ip_address_hash;
-- ALTER TABLE raas_audit_logs DROP COLUMN IF NOT EXISTS user_pseudonym;

-- End of migration
