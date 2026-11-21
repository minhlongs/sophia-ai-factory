-- Migration 0513: Additive Private Bank Artifact Verification & Bounded Email Receipt Review
-- Strictly additive: preserves migrations 0506-0512 without destructive alters or drops.
-- Enforces distinct bank evidence levels, OPERATOR_VERIFIED_BANK_RECORD basis (never BANK_API_VERIFIED),
-- immutable provider-owned email receipt metadata, and prevents auto-denial without verified receiver evidence.

CREATE TABLE IF NOT EXISTS manual_pilot_bank_artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES manual_pilot_financial_state(order_id),
  org_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
  evidence_level TEXT NOT NULL CHECK(evidence_level IN (
    'UNTRUSTED_CUSTOMER_CLAIM',
    'BANK_RECORD_RECEIVED',
    'BANK_RECORD_INDEPENDENTLY_CHECKED',
    'AUTHORIZED_RECONCILIATION',
    'SETTLED_ORDER'
  )),
  storage_key TEXT NOT NULL UNIQUE CHECK(
    storage_key LIKE 'private/manual-pilot-bank-artifacts/%'
    AND storage_key NOT LIKE '%..%'
    AND storage_key NOT LIKE '%\\%'
  ),
  original_filename TEXT NOT NULL CHECK(length(trim(original_filename)) BETWEEN 1 AND 255),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','image/png','image/jpeg','text/csv')),
  file_signature_type TEXT NOT NULL CHECK(file_signature_type IN ('pdf','png','jpeg','csv')),
  byte_size INTEGER NOT NULL CHECK(typeof(byte_size)='integer' AND byte_size BETWEEN 16 AND 5242880),
  artifact_sha256 TEXT NOT NULL CHECK(length(artifact_sha256)=64 AND artifact_sha256 NOT GLOB '*[^a-f0-9]*'),
  uploaded_by_admin_id TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mp_bank_artifacts_order_org
  ON manual_pilot_bank_artifacts(order_id, org_id, direction);

CREATE INDEX IF NOT EXISTS idx_mp_bank_artifacts_sha256
  ON manual_pilot_bank_artifacts(artifact_sha256);

CREATE TRIGGER IF NOT EXISTS mp_bank_artifacts_no_replace
BEFORE INSERT ON manual_pilot_bank_artifacts
WHEN EXISTS(SELECT 1 FROM manual_pilot_bank_artifacts WHERE id=NEW.id OR rowid=NEW.rowid OR storage_key=NEW.storage_key)
BEGIN
  SELECT RAISE(ABORT, 'immutable bank artifact');
END;

CREATE TRIGGER IF NOT EXISTS mp_bank_artifacts_no_delete
BEFORE DELETE ON manual_pilot_bank_artifacts
BEGIN
  SELECT RAISE(ABORT, 'immutable bank artifact');
END;

CREATE TRIGGER IF NOT EXISTS mp_bank_artifacts_immutable_fields
BEFORE UPDATE ON manual_pilot_bank_artifacts
WHEN NEW.id IS NOT OLD.id
  OR NEW.order_id IS NOT OLD.order_id
  OR NEW.org_id IS NOT OLD.org_id
  OR NEW.direction IS NOT OLD.direction
  OR NEW.storage_key IS NOT OLD.storage_key
  OR NEW.original_filename IS NOT OLD.original_filename
  OR NEW.mime_type IS NOT OLD.mime_type
  OR NEW.file_signature_type IS NOT OLD.file_signature_type
  OR NEW.byte_size IS NOT OLD.byte_size
  OR NEW.artifact_sha256 IS NOT OLD.artifact_sha256
  OR NEW.uploaded_by_admin_id IS NOT OLD.uploaded_by_admin_id
  OR NEW.received_at IS NOT OLD.received_at
BEGIN
  SELECT RAISE(ABORT, 'immutable bank artifact');
END;

CREATE TABLE IF NOT EXISTS manual_pilot_bank_artifact_checks (
  id TEXT PRIMARY KEY NOT NULL,
  artifact_id TEXT NOT NULL UNIQUE REFERENCES manual_pilot_bank_artifacts(id),
  order_id TEXT NOT NULL REFERENCES manual_pilot_financial_state(order_id),
  org_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
  evidence_level TEXT NOT NULL CHECK(evidence_level='BANK_RECORD_INDEPENDENTLY_CHECKED'),
  verification_basis TEXT NOT NULL CHECK(verification_basis='OPERATOR_VERIFIED_BANK_RECORD'),
  inspection_source TEXT NOT NULL CHECK(inspection_source IN ('authenticated_bank_portal','official_bank_statement')),
  bank_identity TEXT NOT NULL CHECK(length(trim(bank_identity))>0),
  account_fingerprint TEXT NOT NULL CHECK(length(account_fingerprint)=64 AND account_fingerprint NOT GLOB '*[^a-f0-9]*'),
  original_bank_txn_id TEXT NOT NULL CHECK(length(trim(original_bank_txn_id))>0),
  amount_vnd INTEGER NOT NULL CHECK(typeof(amount_vnd)='integer' AND amount_vnd > 0),
  currency TEXT NOT NULL CHECK(currency='VND'),
  order_reference TEXT NOT NULL CHECK(length(trim(order_reference))>0),
  bank_record_timestamp TEXT NOT NULL,
  operator_checked_at TEXT NOT NULL,
  verified_by_admin_id TEXT NOT NULL,
  counterparty_bank_identity TEXT,
  counterparty_account_identity TEXT,
  evidence_id TEXT UNIQUE REFERENCES manual_pilot_bank_evidence(id),
  audit_event_id TEXT NOT NULL UNIQUE,
  UNIQUE(bank_identity, account_fingerprint, original_bank_txn_id)
);

CREATE INDEX IF NOT EXISTS idx_mp_bank_checks_order_org
  ON manual_pilot_bank_artifact_checks(order_id, org_id, direction);

CREATE TRIGGER IF NOT EXISTS mp_bank_checks_no_replace
BEFORE INSERT ON manual_pilot_bank_artifact_checks
WHEN EXISTS(
  SELECT 1 FROM manual_pilot_bank_artifact_checks
  WHERE id=NEW.id OR rowid=NEW.rowid OR artifact_id=NEW.artifact_id OR audit_event_id=NEW.audit_event_id
    OR (bank_identity=NEW.bank_identity AND account_fingerprint=NEW.account_fingerprint AND original_bank_txn_id=NEW.original_bank_txn_id)
)
BEGIN
  SELECT RAISE(ABORT, 'immutable bank artifact check');
END;

CREATE TRIGGER IF NOT EXISTS mp_bank_checks_no_delete
BEFORE DELETE ON manual_pilot_bank_artifact_checks
BEGIN
  SELECT RAISE(ABORT, 'immutable bank artifact check');
END;

CREATE TRIGGER IF NOT EXISTS mp_bank_checks_immutable_fields
BEFORE UPDATE ON manual_pilot_bank_artifact_checks
WHEN NEW.id IS NOT OLD.id
  OR NEW.artifact_id IS NOT OLD.artifact_id
  OR NEW.order_id IS NOT OLD.order_id
  OR NEW.org_id IS NOT OLD.org_id
  OR NEW.direction IS NOT OLD.direction
  OR NEW.evidence_level IS NOT OLD.evidence_level
  OR NEW.verification_basis IS NOT OLD.verification_basis
  OR NEW.inspection_source IS NOT OLD.inspection_source
  OR NEW.bank_identity IS NOT OLD.bank_identity
  OR NEW.account_fingerprint IS NOT OLD.account_fingerprint
  OR NEW.original_bank_txn_id IS NOT OLD.original_bank_txn_id
  OR NEW.amount_vnd IS NOT OLD.amount_vnd
  OR NEW.currency IS NOT OLD.currency
  OR NEW.order_reference IS NOT OLD.order_reference
  OR NEW.bank_record_timestamp IS NOT OLD.bank_record_timestamp
  OR NEW.operator_checked_at IS NOT OLD.operator_checked_at
  OR NEW.verified_by_admin_id IS NOT OLD.verified_by_admin_id
  OR NEW.counterparty_bank_identity IS NOT OLD.counterparty_bank_identity
  OR NEW.counterparty_account_identity IS NOT OLD.counterparty_account_identity
  OR NEW.audit_event_id IS NOT OLD.audit_event_id
  OR (OLD.evidence_id IS NOT NULL AND NEW.evidence_id IS NOT OLD.evidence_id)
BEGIN
  SELECT RAISE(ABORT, 'immutable bank artifact check');
END;

CREATE TRIGGER IF NOT EXISTS mp_bank_artifacts_sync_reconciled
AFTER UPDATE OF state ON manual_pilot_financial_state
WHEN NEW.state IN ('RECONCILED', 'ADMIN_APPROVED') AND NEW.evidence_id IS NOT NULL
BEGIN
  UPDATE manual_pilot_bank_artifacts
  SET evidence_level = 'AUTHORIZED_RECONCILIATION'
  WHERE id = (
    SELECT artifact_id FROM manual_pilot_bank_artifact_checks
    WHERE evidence_id = NEW.evidence_id AND order_id = NEW.order_id AND direction = 'inbound'
  ) AND evidence_level = 'BANK_RECORD_INDEPENDENTLY_CHECKED';
END;

CREATE TRIGGER IF NOT EXISTS mp_bank_artifacts_sync_settled
AFTER UPDATE OF state ON manual_pilot_financial_state
WHEN NEW.state = 'ACTIVE_14D' AND NEW.evidence_id IS NOT NULL
BEGIN
  UPDATE manual_pilot_bank_artifacts
  SET evidence_level = 'SETTLED_ORDER'
  WHERE id = (
    SELECT artifact_id FROM manual_pilot_bank_artifact_checks
    WHERE evidence_id = NEW.evidence_id AND order_id = NEW.order_id AND direction = 'inbound'
  ) AND evidence_level IN ('BANK_RECORD_INDEPENDENTLY_CHECKED', 'AUTHORIZED_RECONCILIATION');
END;

CREATE TABLE IF NOT EXISTS manual_pilot_email_receipt_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES manual_pilot_financial_state(order_id),
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('goodwill_7d','delivery_failure_14d')),
  state TEXT NOT NULL CHECK(state IN (
    'RECEIVED_UNVERIFIED',
    'RECEIPT_EVIDENCE_ATTACHED',
    'RECEIPT_VERIFIED',
    'ELIGIBILITY_ASSESSED'
  )),
  eligibility_outcome TEXT NOT NULL DEFAULT 'PENDING_MANUAL_REVIEW' CHECK(eligibility_outcome IN (
    'PENDING_MANUAL_REVIEW',
    'ELIGIBLE_TIMELY',
    'INELIGIBLE_OUTSIDE_WINDOW',
    'INELIGIBLE_MISSING_DELIVERY_EVIDENCE'
  )),
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 500),
  beneficiary_bank_identity TEXT NOT NULL CHECK(length(trim(beneficiary_bank_identity))>0),
  beneficiary_account_identity TEXT NOT NULL CHECK(length(trim(beneficiary_account_identity))>0),
  sender_email TEXT,
  untrusted_sender_date_header TEXT,
  provider_mailbox_message_id TEXT UNIQUE,
  provider_received_at TEXT,
  receipt_source TEXT CHECK(receipt_source IS NULL OR receipt_source IN (
    'provider_mailbox_headers',
    'provider_eml_export',
    'mail_gateway_receipt_log'
  )),
  correlation_id TEXT,
  artifact_storage_key TEXT UNIQUE CHECK(
    artifact_storage_key IS NULL OR (
      artifact_storage_key LIKE 'private/manual-pilot-email-receipts/%'
      AND artifact_storage_key NOT LIKE '%..%'
      AND artifact_storage_key NOT LIKE '%\\%'
    )
  ),
  artifact_mime_type TEXT CHECK(artifact_mime_type IS NULL OR artifact_mime_type IN (
    'message/rfc822',
    'application/pdf',
    'image/png',
    'image/jpeg'
  )),
  artifact_byte_size INTEGER CHECK(artifact_byte_size IS NULL OR (typeof(artifact_byte_size)='integer' AND artifact_byte_size BETWEEN 16 AND 5242880)),
  artifact_sha256 TEXT CHECK(artifact_sha256 IS NULL OR (length(artifact_sha256)=64 AND artifact_sha256 NOT GLOB '*[^a-f0-9]*')),
  opened_by_admin_id TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  verified_by_admin_id TEXT,
  verified_at TEXT,
  assessed_by_admin_id TEXT,
  assessed_at TEXT,
  linked_intake_id TEXT REFERENCES manual_pilot_refund_intakes(id),
  delivery_evidence_id TEXT REFERENCES manual_pilot_delivery_evidence(id),
  policy_timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh' CHECK(policy_timezone IN ('Asia/Ho_Chi_Minh','Asia/Saigon')),
  policy_window_days INTEGER NOT NULL CHECK(policy_window_days IN (7, 14)),
  policy_version TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(order_id, category)
);

CREATE INDEX IF NOT EXISTS idx_mp_email_reviews_order_org
  ON manual_pilot_email_receipt_reviews(order_id, org_id, state);

CREATE TRIGGER IF NOT EXISTS mp_email_reviews_no_replace
BEFORE INSERT ON manual_pilot_email_receipt_reviews
WHEN EXISTS(
  SELECT 1 FROM manual_pilot_email_receipt_reviews
  WHERE id=NEW.id OR rowid=NEW.rowid
    OR (order_id=NEW.order_id AND category=NEW.category)
    OR (NEW.provider_mailbox_message_id IS NOT NULL AND provider_mailbox_message_id=NEW.provider_mailbox_message_id)
)
BEGIN
  SELECT RAISE(ABORT, 'immutable email receipt review');
END;

CREATE TRIGGER IF NOT EXISTS mp_email_reviews_no_delete
BEFORE DELETE ON manual_pilot_email_receipt_reviews
BEGIN
  SELECT RAISE(ABORT, 'immutable email receipt review');
END;

CREATE TRIGGER IF NOT EXISTS mp_email_reviews_immutable_provider_fields
BEFORE UPDATE ON manual_pilot_email_receipt_reviews
WHEN NEW.id IS NOT OLD.id
  OR NEW.order_id IS NOT OLD.order_id
  OR NEW.org_id IS NOT OLD.org_id
  OR NEW.user_id IS NOT OLD.user_id
  OR NEW.category IS NOT OLD.category
  OR NEW.opened_by_admin_id IS NOT OLD.opened_by_admin_id
  OR NEW.opened_at IS NOT OLD.opened_at
  OR (OLD.provider_mailbox_message_id IS NOT NULL AND NEW.provider_mailbox_message_id IS NOT OLD.provider_mailbox_message_id)
  OR (OLD.provider_received_at IS NOT NULL AND NEW.provider_received_at IS NOT OLD.provider_received_at)
  OR (OLD.receipt_source IS NOT NULL AND NEW.receipt_source IS NOT OLD.receipt_source)
  OR (OLD.correlation_id IS NOT NULL AND NEW.correlation_id IS NOT OLD.correlation_id)
  OR (OLD.artifact_storage_key IS NOT NULL AND NEW.artifact_storage_key IS NOT OLD.artifact_storage_key)
  OR (OLD.artifact_sha256 IS NOT NULL AND NEW.artifact_sha256 IS NOT OLD.artifact_sha256)
  OR (OLD.verified_at IS NOT NULL AND NEW.verified_at IS NOT OLD.verified_at)
  OR (OLD.assessed_at IS NOT NULL AND NEW.assessed_at IS NOT OLD.assessed_at)
BEGIN
  SELECT RAISE(ABORT, 'immutable email receipt review');
END;

CREATE TRIGGER IF NOT EXISTS mp_email_reviews_no_auto_deny_unverified
BEFORE UPDATE ON manual_pilot_email_receipt_reviews
WHEN NEW.eligibility_outcome != 'PENDING_MANUAL_REVIEW'
  AND (
    NEW.state != 'ELIGIBILITY_ASSESSED'
    OR NEW.provider_mailbox_message_id IS NULL
    OR NEW.provider_received_at IS NULL
    OR NEW.receipt_source IS NULL
    OR NEW.verified_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'cannot deny or finalize eligibility without verified receiver evidence');
END;

CREATE TABLE IF NOT EXISTS manual_pilot_email_review_events (
  id TEXT PRIMARY KEY NOT NULL,
  review_id TEXT NOT NULL REFERENCES manual_pilot_email_receipt_reviews(id),
  order_id TEXT NOT NULL REFERENCES manual_pilot_financial_state(order_id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  eligibility_outcome TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mp_email_review_events_review
  ON manual_pilot_email_review_events(review_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS mp_email_review_events_no_replace
BEFORE INSERT ON manual_pilot_email_review_events
WHEN EXISTS(SELECT 1 FROM manual_pilot_email_review_events WHERE id=NEW.id OR rowid=NEW.rowid)
BEGIN
  SELECT RAISE(ABORT, 'immutable email review audit');
END;

CREATE TRIGGER IF NOT EXISTS mp_email_review_events_no_update
BEFORE UPDATE ON manual_pilot_email_review_events
BEGIN
  SELECT RAISE(ABORT, 'immutable email review audit');
END;

CREATE TRIGGER IF NOT EXISTS mp_email_review_events_no_delete
BEFORE DELETE ON manual_pilot_email_review_events
BEGIN
  SELECT RAISE(ABORT, 'immutable email review audit');
END;

-- No authenticated mailbox receiver exists. Prevent first-write assertions from
-- being mistaken for receiver-owned evidence, including direct admin updates.
CREATE TRIGGER IF NOT EXISTS mp_email_receiver_unavailable_insert
BEFORE INSERT ON manual_pilot_email_receipt_reviews
WHEN NEW.state NOT IN ('RECEIVED_UNVERIFIED','RECEIPT_EVIDENCE_ATTACHED')
  OR NEW.provider_mailbox_message_id IS NOT NULL OR NEW.provider_received_at IS NOT NULL
  OR NEW.receipt_source IS NOT NULL OR NEW.correlation_id IS NOT NULL
  OR NEW.eligibility_outcome != 'PENDING_MANUAL_REVIEW'
BEGIN SELECT RAISE(ABORT, 'authoritative receiver unavailable'); END;
CREATE TRIGGER IF NOT EXISTS mp_email_receiver_unavailable_update
BEFORE UPDATE ON manual_pilot_email_receipt_reviews
WHEN NEW.provider_mailbox_message_id IS NOT OLD.provider_mailbox_message_id
  OR NEW.provider_received_at IS NOT OLD.provider_received_at
  OR NEW.receipt_source IS NOT OLD.receipt_source OR NEW.correlation_id IS NOT OLD.correlation_id
  OR NEW.state NOT IN ('RECEIVED_UNVERIFIED','RECEIPT_EVIDENCE_ATTACHED')
BEGIN SELECT RAISE(ABORT, 'authoritative receiver unavailable'); END;
