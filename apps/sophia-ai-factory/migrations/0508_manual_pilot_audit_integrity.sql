-- Audit history is append-only; corrections require a new entry.
CREATE TRIGGER IF NOT EXISTS manual_pilot_audit_no_replace
BEFORE INSERT ON manual_pilot_audit_log
WHEN EXISTS(SELECT 1 FROM manual_pilot_audit_log WHERE id=NEW.id OR rowid=NEW.rowid)
BEGIN
  SELECT RAISE(ABORT, 'immutable manual pilot audit');
END;

CREATE TRIGGER IF NOT EXISTS manual_pilot_audit_no_update
BEFORE UPDATE ON manual_pilot_audit_log
BEGIN
  SELECT RAISE(ABORT, 'immutable manual pilot audit');
END;

CREATE TRIGGER IF NOT EXISTS manual_pilot_audit_no_delete
BEFORE DELETE ON manual_pilot_audit_log
BEGIN
  SELECT RAISE(ABORT, 'immutable manual pilot audit');
END;
