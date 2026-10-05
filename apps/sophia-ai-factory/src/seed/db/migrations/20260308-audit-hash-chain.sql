-- ROIaaS Compliance Audit Trail - Hash Chain Migration
-- Migration: Add cryptographic hash chain to raas_audit_logs
-- Date: 2026-03-08
-- Description: Add immutable hash chain for audit log integrity verification (SOC 2 compliance)

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

-- 1. Add hash chain columns
ALTER TABLE raas_audit_logs
  ADD COLUMN IF NOT EXISTS content_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS previous_log_hash TEXT,
  ADD COLUMN IF NOT EXISTS hash_chain_valid BOOLEAN DEFAULT true;

-- 2. Create indexes for hash verification performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_content_hash ON raas_audit_logs(content_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hash_chain ON raas_audit_logs(previous_log_hash);

-- 3. Create trigger function to build hash chain on insert
-- SECURITY DEFINER: Run with creator's permissions to avoid RLS issues
CREATE OR REPLACE FUNCTION update_audit_hash_chain()
RETURNS TRIGGER AS $$
DECLARE
  prev_hash TEXT;
  content_text TEXT;
  hash_salt TEXT;
BEGIN
  -- Get previous log's content_hash (most recent by created_at)
  -- Use FOR UPDATE to prevent race conditions with concurrent inserts
  SELECT content_hash INTO prev_hash
  FROM raas_audit_logs
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- Get salt from app settings (fallback to empty string if not set)
  BEGIN
    SELECT current_setting('app.audit_hash_salt', true) INTO hash_salt;
    IF hash_salt IS NULL THEN
      hash_salt := '';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    hash_salt := '';
  END;

  -- Build deterministic content string for hashing
  -- Format: action|nonce|user_id|ip|timestamp|prev_hash|salt
  content_text := COALESCE(NEW.action, '') || '|'||
                  COALESCE(NEW.license_nonce, '') || '|'||
                  COALESCE(NEW.user_id::text, '') || '|'||
                  COALESCE(NEW.ip_address, '') || '|'||
                  NEW.created_at::text || '|'||
                  COALESCE(prev_hash, '') || '|'||
                  hash_salt;

  -- Compute SHA-256 hash and store as hex string
  NEW.content_hash := encode(digest(content_text, 'sha256'), 'hex');
  NEW.previous_log_hash := prev_hash;
  NEW.hash_chain_valid := true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger to auto-compute hash on every insert
DROP TRIGGER IF EXISTS trigger_audit_hash_chain ON raas_audit_logs;
CREATE TRIGGER trigger_audit_hash_chain
  BEFORE INSERT ON raas_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_hash_chain();

-- 5. Add hash chain verification function
-- Returns: TRUE if chain is valid, FALSE if any link is broken
CREATE OR REPLACE FUNCTION verify_audit_hash_chain()
RETURNS TABLE (
  log_id UUID,
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  prev_record RECORD;
  current_hash TEXT;
  expected_hash TEXT;
  content_text TEXT;
  hash_salt TEXT;
BEGIN
  -- Get salt
  BEGIN
    SELECT current_setting('app.audit_hash_salt', true) INTO hash_salt;
    IF hash_salt IS NULL THEN
      hash_salt := '';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    hash_salt := '';
  END;

  prev_record := NULL;

  -- Iterate through logs in chronological order
  FOR log_record IN
    SELECT id, action, license_nonce, user_id, ip_address, created_at,
           content_hash, previous_log_hash, hash_chain_valid
    FROM raas_audit_logs
    ORDER BY created_at ASC
  LOOP
    -- Build expected content hash
    content_text := COALESCE(log_record.action, '') || '|'||
                    COALESCE(log_record.license_nonce, '') || '|'||
                    COALESCE(log_record.user_id::text, '') || '|'||
                    COALESCE(log_record.ip_address, '') || '|'||
                    log_record.created_at::text || '|'||
                    COALESCE(prev_record.content_hash, '') || '|'||
                    hash_salt;

    expected_hash := encode(digest(content_text, 'sha256'), 'hex');

    -- Check if content_hash matches
    IF log_record.content_hash != expected_hash THEN
      log_id := log_record.id;
      is_valid := false;
      error_message := 'Content hash mismatch - possible tampering';
      RETURN NEXT;
    -- Check if previous_log_hash links correctly
    ELSIF log_record.previous_log_hash IS DISTINCT FROM prev_record.content_hash THEN
      log_id := log_record.id;
      is_valid := false;
      error_message := 'Previous hash link broken - chain interrupted';
      RETURN NEXT;
    ELSE
      log_id := log_record.id;
      is_valid := true;
      error_message := NULL;
      RETURN NEXT;
    END IF;

    prev_record := log_record;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. Add comment documenting the hash chain purpose
COMMENT ON COLUMN raas_audit_logs.content_hash IS 'SHA-256 hash of log content + previous hash (immutable audit trail)';
COMMENT ON COLUMN raas_audit_logs.previous_log_hash IS 'Hash pointer to previous log entry (hash chain linkage)';
COMMENT ON COLUMN raas_audit_logs.hash_chain_valid IS 'True if hash chain verification passes, false if tampered';
COMMENT ON FUNCTION update_audit_hash_chain() IS 'Auto-computes content_hash and previous_log_hash on INSERT';
COMMENT ON FUNCTION verify_audit_hash_chain() IS 'Verifies entire hash chain integrity - returns any broken links';

-- ============================================================================
-- DOWN MIGRATION (Rollback)
-- ============================================================================

-- To rollback, execute these in order:
-- DROP TRIGGER IF EXISTS trigger_audit_hash_chain ON raas_audit_logs;
-- DROP FUNCTION IF EXISTS verify_audit_hash_chain();
-- DROP FUNCTION IF EXISTS update_audit_hash_chain();
-- DROP INDEX IF EXISTS idx_audit_logs_content_hash;
-- DROP INDEX IF EXISTS idx_audit_logs_hash_chain;
-- ALTER TABLE raas_audit_logs DROP COLUMN IF EXISTS content_hash;
-- ALTER TABLE raas_audit_logs DROP COLUMN IF EXISTS previous_log_hash;
-- ALTER TABLE raas_audit_logs DROP COLUMN IF EXISTS hash_chain_valid;

-- End of migration
