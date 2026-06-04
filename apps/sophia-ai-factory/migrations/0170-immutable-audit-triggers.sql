-- Migration 0170: Immutable audit log enforcement triggers
-- SOC 2 Type I CC6.6: Audit records MUST be immutable once written.
-- These triggers raise an error on any UPDATE or DELETE against audit tables,
-- enforcing append-only semantics at the database level (not just convention).
--
-- Evidence: SOC 2 auditor can verify by attempting:
--   UPDATE admin_audit_log SET payload = 'hacked' WHERE id = '...';
--   -> "ERROR: admin_audit_log is immutable - updates and deletes are prohibited"
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
-- raas_audit_logs - immutability trigger
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS trg_raas_audit_logs_immutable
BEFORE UPDATE ON raas_audit_logs
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'raas_audit_logs is immutable - UPDATE prohibited (CC6.6)');
END;

CREATE TRIGGER IF NOT EXISTS trg_raas_audit_logs_no_delete
BEFORE DELETE ON raas_audit_logs
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'raas_audit_logs is immutable - DELETE prohibited (CC6.6)');
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
FROM admin_audit_log

UNION ALL

SELECT
  'raas_audit_logs'         AS table_name,
  COUNT(*)                  AS total_entries,
  MIN(created_at)           AS oldest_entry,
  MAX(created_at)           AS newest_entry,
  COUNT(DISTINCT user_id)   AS distinct_actors
FROM raas_audit_logs;
