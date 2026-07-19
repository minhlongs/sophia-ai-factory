-- Migration 0210: Relax raas_audit_logs action CHECK constraint
--
-- The original CHECK constraint (action IN ('CREATE','VALIDATE','REVOKE','UPDATE'))
-- was designed for license-only audit. Key rotation events (key_rotation.*) are
-- silently rejected, breaking the SOC 2 audit trail for rotation.
--
-- This migration rebuilds the table without the restrictive CHECK constraint,
-- keeping only NOT NULL. Validation moves to application level (logAuditEvent()).
--
-- SQLite limitation: cannot ALTER TABLE to modify CHECK constraints; must rebuild.

-- 1. Create new table without restrictive CHECK
CREATE TABLE IF NOT EXISTS raas_audit_logs_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  action TEXT NOT NULL,
  license_id TEXT REFERENCES raas_licenses(id),
  license_nonce TEXT,
  user_id TEXT REFERENCES users(id),
  ip_address TEXT,
  user_agent TEXT,
  details TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL,
  model_name TEXT,
  token_count INTEGER,
  ip_address_hash TEXT,
  user_pseudonym TEXT,
  previous_log_hash TEXT,
  content_hash TEXT NOT NULL DEFAULT '',
  hash_chain_valid INTEGER DEFAULT 1
);

-- 2. Copy existing data (safe: new schema is superset of old)
INSERT INTO raas_audit_logs_new (
  id, action, license_id, license_nonce, user_id,
  ip_address, user_agent, details, created_at,
  model_name, token_count, ip_address_hash, user_pseudonym,
  previous_log_hash, content_hash, hash_chain_valid
)
SELECT
  id, action, license_id, license_nonce, user_id,
  ip_address, user_agent, details, created_at,
  model_name, token_count, ip_address_hash, user_pseudonym,
  previous_log_hash, content_hash, hash_chain_valid
FROM raas_audit_logs;

-- 3. Swap tables
DROP TABLE raas_audit_logs;
ALTER TABLE raas_audit_logs_new RENAME TO raas_audit_logs;

-- 4. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_license_id ON raas_audit_logs(license_id);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_license_nonce ON raas_audit_logs(license_nonce);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_user_id ON raas_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_action ON raas_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_created_at ON raas_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_content_hash ON raas_audit_logs(content_hash);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_previous_hash ON raas_audit_logs(previous_log_hash);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_chain_valid ON raas_audit_logs(hash_chain_valid);

-- 5. Verify
SELECT '0210: OK' AS migration_status
FROM raas_audit_logs
LIMIT 1;
