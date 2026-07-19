-- Migration: Audit Log Retention Functions
-- Date: 2026-03-06
-- Purpose: Archive and cleanup functions for audit log retention compliance
--          SOC 2: 90 days minimum | PCI DSS: 1 year archive

-- ============================================================================
-- Part 1: Archive Table Schema
-- ============================================================================

-- Archive table for long-term storage (PCI DSS 1-year compliance)
CREATE TABLE IF NOT EXISTS raas_audit_logs_archive (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL,
  license_id UUID,
  license_nonce TEXT,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for archive queries
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_archive_created_at
  ON raas_audit_logs_archive(created_at DESC);

-- ============================================================================
-- Part 2: Cleanup Function
-- ============================================================================

-- Function: Archive and delete old audit logs
-- Parameters:
--   retention_days: Number of days to retain in active storage (default: 90)
--   archive_enabled: Whether to archive before deletion (default: true)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
  retention_days INTEGER DEFAULT 90,
  archive_enabled BOOLEAN DEFAULT true
)
RETURNS TABLE(archived_count INTEGER, deleted_count INTEGER) AS $$
DECLARE
  v_cutoff_timestamp BIGINT;
  v_archived INTEGER := 0;
  v_deleted INTEGER := 0;
BEGIN
  -- Calculate cutoff timestamp (seconds since epoch)
  v_cutoff_timestamp := EXTRACT(EPOCH FROM (NOW() - (retention_days || ' days')::INTERVAL))::BIGINT;

  -- Archive old logs if enabled
  IF archive_enabled THEN
    INSERT INTO raas_audit_logs_archive (
      id, action, license_id, license_nonce, user_id, ip_address,
      user_agent, details, created_at, archived_at
    )
    SELECT
      id, action, license_id, license_nonce, user_id, ip_address,
      user_agent, details, created_at, NOW()
    FROM raas_audit_logs
    WHERE created_at < v_cutoff_timestamp;

    GET DIAGNOSTICS v_archived = ROW_COUNT;
  END IF;

  -- Delete old logs from main table
  DELETE FROM raas_audit_logs
  WHERE created_at < v_cutoff_timestamp;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Return counts
  RETURN QUERY SELECT v_archived, v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Part 3: Scheduled Job (requires pg_cron extension)
-- ============================================================================

-- Enable pg_cron extension if not already enabled
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM UTC
-- SELECT cron.schedule(
--   'daily-audit-log-cleanup',
--   '0 2 * * *',  -- Every day at 2 AM
--   $$SELECT cleanup_old_audit_logs(90, true)$$
-- );

-- ============================================================================
-- Part 4: Manual Execution Helper
-- ============================================================================

-- Helper function to get retention stats
CREATE OR REPLACE FUNCTION get_audit_log_stats()
RETURNS TABLE(
  total_logs BIGINT,
  logs_90_days BIGINT,
  logs_30_days BIGINT,
  archive_count BIGINT,
  oldest_log_timestamp TIMESTAMPTZ,
  newest_log_timestamp TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM raas_audit_logs) AS total_logs,
    (SELECT COUNT(*) FROM raas_audit_logs
     WHERE created_at >= EXTRACT(EPOCH FROM (NOW() - INTERVAL '90 days'))::BIGINT) AS logs_90_days,
    (SELECT COUNT(*) FROM raas_audit_logs
     WHERE created_at >= EXTRACT(EPOCH FROM (NOW() - INTERVAL '30 days'))::BIGINT) AS logs_30_days,
    (SELECT COUNT(*) FROM raas_audit_logs_archive) AS archive_count,
    (SELECT TO_TIMESTAMP(MIN(created_at)) FROM raas_audit_logs) AS oldest_log_timestamp,
    (SELECT TO_TIMESTAMP(MAX(created_at)) FROM raas_audit_logs) AS newest_log_timestamp;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Part 5: GDPR Right-to-Erasure Function
-- ============================================================================

-- Function: Anonymize user data for GDPR right-to-erasure
-- Note: Use with caution - audit logs are important for compliance
-- Only anonymize, don't delete, to maintain audit trail integrity
CREATE OR REPLACE FUNCTION anonymize_user_audit_logs(
  target_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count logs to be anonymized
  SELECT COUNT(*) INTO v_count
  FROM raas_audit_logs
  WHERE user_id = target_user_id;

  -- Anonymize user data
  UPDATE raas_audit_logs
  SET
    user_id = NULL,
    ip_address = '[ANONYMIZED]',
    user_agent = '[ANONYMIZED]',
    details = details || '{"anonymized": true, "reason": "GDPR right-to-erasure"}'::jsonb
  WHERE user_id = target_user_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Usage Examples
-- ============================================================================

-- Run cleanup manually (90 days retention, archive enabled)
-- SELECT * FROM cleanup_old_audit_logs(90, true);

-- Get current stats
-- SELECT * FROM get_audit_log_stats();

-- Anonymize user data for GDPR
-- SELECT anonymize_user_audit_logs('user-uuid-here');

-- End of migration
