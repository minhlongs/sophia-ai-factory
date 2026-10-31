-- 0490_opc_arm_applied_events.sql
-- Exactly-once atomic application tracking per arm and event.
-- Gating arm updates via primary key constraint on (tenant_id, arm_id, event_id)
-- and per-execution claim token provides true atomic idempotency across arbitrary
-- interleavings (A -> B -> A, N concurrent duplicates, and fault rollbacks) without race conditions.

CREATE TABLE IF NOT EXISTS opc_arm_applied_events (
  tenant_id       TEXT NOT NULL,
  arm_id          TEXT NOT NULL,
  event_id        TEXT NOT NULL,
  claim_token     TEXT NOT NULL,
  applied_at      INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, arm_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_opc_arm_applied_events_tenant_event
  ON opc_arm_applied_events (tenant_id, event_id);
