-- VN: Yêu cầu gốc và tài khoản nhận tiền không thể sửa. EN: Immutable customer instruction.
CREATE TABLE manual_pilot_refund_intakes (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES manual_pilot_financial_state(order_id),
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('goodwill_7d','delivery_failure_14d')),
  reason TEXT NOT NULL,
  beneficiary_bank_identity TEXT NOT NULL CHECK(length(trim(beneficiary_bank_identity))>0),
  beneficiary_account_identity TEXT NOT NULL CHECK(length(trim(beneficiary_account_identity))>0),
  received_at TEXT NOT NULL,
  UNIQUE(order_id,category)
);
CREATE TRIGGER manual_pilot_refund_intake_no_replace BEFORE INSERT ON manual_pilot_refund_intakes
WHEN EXISTS(SELECT 1 FROM manual_pilot_refund_intakes WHERE id=NEW.id OR rowid=NEW.rowid
  OR (order_id=NEW.order_id AND category=NEW.category))
BEGIN SELECT RAISE(ABORT,'immutable refund intake'); END;
CREATE TRIGGER manual_pilot_refund_intake_no_update BEFORE UPDATE ON manual_pilot_refund_intakes
BEGIN SELECT RAISE(ABORT,'immutable refund intake'); END;
CREATE TRIGGER manual_pilot_refund_intake_no_delete BEFORE DELETE ON manual_pilot_refund_intakes
BEGIN SELECT RAISE(ABORT,'immutable refund intake'); END;
ALTER TABLE manual_pilot_refund_state ADD COLUMN intake_id TEXT REFERENCES manual_pilot_refund_intakes(id);
-- Separate additive evidence preserves the shape of historical bank artifacts.
CREATE TABLE manual_pilot_bank_counterparties (
  evidence_id TEXT PRIMARY KEY NOT NULL REFERENCES manual_pilot_bank_evidence(id),
  bank_identity TEXT NOT NULL CHECK(length(trim(bank_identity))>0),
  account_identity TEXT NOT NULL CHECK(length(trim(account_identity))>0)
);
CREATE TRIGGER manual_pilot_counterparty_no_replace BEFORE INSERT ON manual_pilot_bank_counterparties
WHEN EXISTS(SELECT 1 FROM manual_pilot_bank_counterparties WHERE evidence_id=NEW.evidence_id OR rowid=NEW.rowid)
BEGIN SELECT RAISE(ABORT,'immutable bank counterparty'); END;
CREATE TRIGGER manual_pilot_counterparty_no_update BEFORE UPDATE ON manual_pilot_bank_counterparties
BEGIN SELECT RAISE(ABORT,'immutable bank counterparty'); END;
CREATE TRIGGER manual_pilot_counterparty_no_delete BEFORE DELETE ON manual_pilot_bank_counterparties
BEGIN SELECT RAISE(ABORT,'immutable bank counterparty'); END;
CREATE TRIGGER manual_pilot_bank_evidence_no_replace BEFORE INSERT ON manual_pilot_bank_evidence
WHEN EXISTS(SELECT 1 FROM manual_pilot_bank_evidence WHERE id=NEW.id OR rowid=NEW.rowid
  OR (bank_identity=NEW.bank_identity AND account_identity=NEW.account_identity AND transaction_identity=NEW.transaction_identity))
BEGIN SELECT RAISE(ABORT,'immutable bank evidence'); END;
CREATE TRIGGER manual_pilot_financial_event_no_replace BEFORE INSERT ON manual_pilot_financial_events
WHEN EXISTS(SELECT 1 FROM manual_pilot_financial_events WHERE id=NEW.id OR rowid=NEW.rowid)
BEGIN SELECT RAISE(ABORT,'immutable financial event'); END;
CREATE TRIGGER manual_pilot_refund_intake_binding_no_update BEFORE UPDATE OF intake_id ON manual_pilot_refund_state
WHEN NEW.intake_id IS NOT OLD.intake_id
BEGIN SELECT RAISE(ABORT,'immutable refund intake binding'); END;
CREATE TRIGGER manual_pilot_refund_state_no_replace BEFORE INSERT ON manual_pilot_refund_state
WHEN EXISTS(SELECT 1 FROM manual_pilot_refund_state WHERE order_id=NEW.order_id OR rowid=NEW.rowid OR evidence_id=NEW.evidence_id)
BEGIN SELECT RAISE(ABORT,'immutable refund state identity'); END;
CREATE TRIGGER manual_pilot_refund_state_no_delete BEFORE DELETE ON manual_pilot_refund_state
BEGIN SELECT RAISE(ABORT,'immutable refund state identity'); END;
CREATE TRIGGER manual_pilot_refund_identity_no_update
BEFORE UPDATE OF order_id,amount_vnd,category,requested_at ON manual_pilot_refund_state
WHEN NEW.order_id IS NOT OLD.order_id OR NEW.amount_vnd IS NOT OLD.amount_vnd
  OR NEW.category IS NOT OLD.category OR NEW.requested_at IS NOT OLD.requested_at
BEGIN SELECT RAISE(ABORT,'immutable refund state identity'); END;
