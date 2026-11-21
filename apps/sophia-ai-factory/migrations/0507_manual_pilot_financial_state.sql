-- Additive financial state; legacy rows are quarantined, never silently verified.
CREATE TABLE manual_pilot_financial_state (
  order_id TEXT PRIMARY KEY REFERENCES manual_pilot_settlements(order_id),
  org_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('PENDING_ORDER','BANK_SETTLEMENT_VERIFIED','RECONCILED','ADMIN_APPROVED','ACTIVE_14D','LEGACY_REVIEW','REJECTED')),
  evidence_id TEXT UNIQUE,
  attempt_token TEXT UNIQUE,
  updated_at TEXT NOT NULL
);
INSERT INTO manual_pilot_financial_state(order_id,org_id,state,updated_at)
SELECT order_id,COALESCE(org_id,''),'LEGACY_REVIEW',updated_at FROM manual_pilot_settlements;

CREATE TABLE manual_pilot_bank_evidence (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES manual_pilot_financial_state(order_id),
  org_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
  bank_identity TEXT NOT NULL,
  account_identity TEXT NOT NULL,
  transaction_identity TEXT NOT NULL,
  amount_vnd INTEGER NOT NULL CHECK(typeof(amount_vnd)='integer' AND amount_vnd > 0),
  currency TEXT NOT NULL CHECK(currency='VND'),
  settled_at TEXT NOT NULL,
  order_reference TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL CHECK(length(artifact_sha256)=64),
  source TEXT NOT NULL,
  verifier TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  UNIQUE(bank_identity,account_identity,transaction_identity)
);
CREATE TRIGGER manual_pilot_evidence_no_update BEFORE UPDATE ON manual_pilot_bank_evidence BEGIN SELECT RAISE(ABORT,'immutable bank evidence'); END;
CREATE TRIGGER manual_pilot_evidence_no_delete BEFORE DELETE ON manual_pilot_bank_evidence BEGIN SELECT RAISE(ABORT,'immutable bank evidence'); END;

CREATE TABLE manual_pilot_financial_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES manual_pilot_financial_state(order_id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  evidence_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TRIGGER manual_pilot_events_no_update BEFORE UPDATE ON manual_pilot_financial_events BEGIN SELECT RAISE(ABORT,'immutable financial event'); END;
CREATE TRIGGER manual_pilot_events_no_delete BEFORE DELETE ON manual_pilot_financial_events BEGIN SELECT RAISE(ABORT,'immutable financial event'); END;

CREATE TABLE manual_pilot_credit_grants (
  order_id TEXT PRIMARY KEY REFERENCES manual_pilot_financial_state(order_id),
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  granted REAL NOT NULL CHECK(granted > 0),
  consumed REAL NOT NULL DEFAULT 0 CHECK(consumed >= 0),
  revoked REAL NOT NULL DEFAULT 0 CHECK(revoked >= 0),
  expires_at TEXT NOT NULL,
  CHECK(consumed + revoked <= granted)
);
CREATE TABLE manual_pilot_entitlements (
  order_id TEXT PRIMARY KEY REFERENCES manual_pilot_financial_state(order_id),
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE manual_pilot_refund_state (
  order_id TEXT PRIMARY KEY REFERENCES manual_pilot_financial_state(order_id),
  state TEXT NOT NULL CHECK(state IN ('REQUESTED','APPROVED','TRANSFER_PENDING','SETTLED')),
  amount_vnd INTEGER NOT NULL CHECK(typeof(amount_vnd)='integer' AND amount_vnd > 0),
  category TEXT NOT NULL CHECK(category IN ('goodwill_7d','delivery_failure_14d')),
  evidence_id TEXT UNIQUE,
  requested_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE manual_pilot_credit_debits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount>0),
  created_at TEXT NOT NULL
);
CREATE TABLE manual_pilot_credit_allocations (
  debit_id TEXT NOT NULL REFERENCES manual_pilot_credit_debits(id),
  order_id TEXT NOT NULL REFERENCES manual_pilot_credit_grants(order_id),
  amount REAL NOT NULL CHECK(amount>0),
  PRIMARY KEY(debit_id,order_id)
);
