-- Manual verification is an accountable admin attestation, not an automatic
-- classifier or independent bank proof. Source artifacts remain referenced by
-- immutable digest; corrections require a new record and audit event.
CREATE TABLE manual_pilot_delivery_evidence (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES manual_pilot_financial_state(order_id),
  org_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('option_a_campaign','option_a_script')),
  attribution TEXT NOT NULL CHECK(attribution='sophia'),
  artifact_ref TEXT NOT NULL CHECK(length(trim(artifact_ref)) BETWEEN 3 AND 500),
  artifact_sha256 TEXT NOT NULL CHECK(length(artifact_sha256)=64 AND artifact_sha256 NOT GLOB '*[^a-f0-9]*'),
  occurred_at TEXT NOT NULL,
  verified_by_admin_id TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE,
  policy_timezone TEXT NOT NULL CHECK(policy_timezone='Asia/Saigon'),
  policy_window_days INTEGER NOT NULL CHECK(policy_window_days=14),
  policy_version TEXT NOT NULL,
  UNIQUE(order_id,artifact_ref,artifact_sha256)
);
CREATE INDEX manual_pilot_delivery_evidence_order ON manual_pilot_delivery_evidence(order_id,org_id);
CREATE TRIGGER manual_pilot_delivery_evidence_no_replace BEFORE INSERT ON manual_pilot_delivery_evidence
WHEN EXISTS(SELECT 1 FROM manual_pilot_delivery_evidence WHERE id=NEW.id OR rowid=NEW.rowid
  OR audit_event_id=NEW.audit_event_id
  OR (order_id=NEW.order_id AND artifact_ref=NEW.artifact_ref AND artifact_sha256=NEW.artifact_sha256))
BEGIN SELECT RAISE(ABORT,'immutable delivery evidence'); END;
CREATE TRIGGER manual_pilot_delivery_evidence_no_update BEFORE UPDATE ON manual_pilot_delivery_evidence
BEGIN SELECT RAISE(ABORT,'immutable delivery evidence'); END;
CREATE TRIGGER manual_pilot_delivery_evidence_no_delete BEFORE DELETE ON manual_pilot_delivery_evidence
BEGIN SELECT RAISE(ABORT,'immutable delivery evidence'); END;
-- SQLite REPLACE does not run DELETE triggers unless recursive triggers are on.
CREATE TRIGGER manual_pilot_delivery_event_no_replace BEFORE INSERT ON manual_pilot_financial_events
WHEN EXISTS(SELECT 1 FROM manual_pilot_financial_events e
  JOIN manual_pilot_delivery_evidence d ON d.audit_event_id=e.id
  WHERE e.id=NEW.id OR e.rowid=NEW.rowid)
BEGIN SELECT RAISE(ABORT,'immutable delivery verification audit'); END;
