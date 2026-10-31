-- 0492_opc_deferred_event_binding.sql
-- Enforce immutable event identity, unique arm binding per event, and deferred accounting state.
-- Cloudflare D1 / SQLite compatible.

-- 1. Unique index on (tenant_id, event_id) for arm claims:
-- Guarantees at the database engine level that no eventId can ever be claimed by multiple distinct arms.
CREATE UNIQUE INDEX IF NOT EXISTS idx_opc_arm_applied_events_tenant_event_uniq
  ON opc_arm_applied_events (tenant_id, event_id);

-- 2. Indexes for efficient lookup of status and payload identity on opc_feedback_events:
CREATE INDEX IF NOT EXISTS idx_opc_feedback_events_status
  ON opc_feedback_events (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_opc_feedback_events_tenant_arm_hash
  ON opc_feedback_events (tenant_id, arm_id, payload_hash);
