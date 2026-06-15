-- Migration 0170: Immutable admin audit log enforcement triggers
-- SOC 2 Type I CC6.6: Admin audit records MUST be immutable once written.
-- These triggers raise an error on any UPDATE or DELETE against admin_audit_log,
-- enforcing append-only semantics at the D1 database level (not just convention).
--
-- Scope note:
-- - admin_audit_log is the canonical D1 admin action audit table in production.
-- - raas_audit_logs is a Supabase/Postgres table in the current app code path,
--   not present in the production D1 database. Its immutability must be verified
--   separately with Supabase/Postgres controls.
-- - audit_log is currently included in account cascade deletion. Do not add a D1
--   immutability trigger there until the privacy/account-deletion contract is
--   redesigned to use anonymization instead of deletion.
--
-- Evidence: SOC 2 auditor can verify by attempting:
--   UPDATE admin_audit_log SET payload = 'hacked' WHERE id = '...';
--   -> "ERROR: admin_audit_log is immutable - UPDATE prohibited (CC6.6)"
-- Compliance: CC6.6 (audit logging immutability), CC6.1 (logical access controls)

-- =============================================================================
-- admin_audit_log - immutability trigger
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS trg_admin_audit_log_immutable
BEFORE UPDATE ON admin_audit_log
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'admin_audit_log is immutable - UPDATE prohibited (CC6.6)');
END;

CREATE TRIGGER IF NOT EXISTS trg_admin_audit_log_no_delete
BEFORE DELETE ON admin_audit_log
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'admin_audit_log is immutable - DELETE prohibited (CC6.6)');
END;

-- =============================================================================
-- Verification view for compliance reporting (non-mutating)
-- =============================================================================

CREATE VIEW IF NOT EXISTS v_audit_log_health AS
SELECT
  'admin_audit_log'         AS table_name,
  COUNT(*)                  AS total_entries,
  MIN(created_at)           AS oldest_entry,
  MAX(created_at)           AS newest_entry,
  COUNT(DISTINCT actor_user_id) AS distinct_actors
FROM admin_audit_log;
