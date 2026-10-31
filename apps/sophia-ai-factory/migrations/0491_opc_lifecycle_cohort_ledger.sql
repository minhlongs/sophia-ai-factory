-- 0491_opc_lifecycle_cohort_ledger.sql
-- OPC Feedback Cohort and Reconciliation Ledger (D1 / SQLite compatible).
-- Tracks parent cohort origin, pending/settled/reversed lifecycle quantities,
-- and logical adjustment idempotency for rigorous affiliate feedback accounting.

CREATE TABLE IF NOT EXISTS opc_cohort_records (
  tenant_id                 TEXT NOT NULL,
  cohort_id                 TEXT NOT NULL,
  arm_id                    TEXT NOT NULL,
  provider                  TEXT NOT NULL DEFAULT 'unknown',
  initial_impressions       INTEGER NOT NULL DEFAULT 0,
  initial_cost_cents        INTEGER NOT NULL DEFAULT 0,
  pending_conversions       INTEGER NOT NULL DEFAULT 0,
  settled_conversions       INTEGER NOT NULL DEFAULT 0,
  reversed_conversions      INTEGER NOT NULL DEFAULT 0,
  settled_reward_cents      INTEGER NOT NULL DEFAULT 0,
  reversed_reward_cents     INTEGER NOT NULL DEFAULT 0,
  created_at                INTEGER NOT NULL,
  updated_at                INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, cohort_id)
);

CREATE INDEX IF NOT EXISTS idx_opc_cohort_records_tenant_arm
  ON opc_cohort_records (tenant_id, arm_id);

CREATE TABLE IF NOT EXISTS opc_logical_adjustments (
  tenant_id                 TEXT NOT NULL,
  adjustment_id             TEXT NOT NULL,
  cohort_id                 TEXT NOT NULL,
  arm_id                    TEXT NOT NULL,
  adjustment_type           TEXT NOT NULL CHECK (adjustment_type IN ('settlement', 'reversal')),
  delta_conversions         INTEGER NOT NULL,
  delta_reward_cents        INTEGER NOT NULL,
  claim_token               TEXT NOT NULL DEFAULT '',
  applied_at                INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, adjustment_id)
);

CREATE INDEX IF NOT EXISTS idx_opc_logical_adjustments_tenant_cohort
  ON opc_logical_adjustments (tenant_id, cohort_id);

-- Add payload_hash and status to opc_feedback_events for canonical accounting identity and zero-row CAS handling
ALTER TABLE opc_feedback_events ADD COLUMN payload_hash TEXT DEFAULT NULL;
ALTER TABLE opc_feedback_events ADD COLUMN status TEXT NOT NULL DEFAULT 'applied';

