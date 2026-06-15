-- Migration 0027: Audit logging + constraint hardening
-- Additive only — no modifications to existing data

-- ── Audit log table ────────────────────────────────────────────────────────────
-- Cheap append-only trail for tier-changing mutations (subscriptions, wallets, etc.)
CREATE TABLE IF NOT EXISTS billing_audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT    NOT NULL,
  row_id     TEXT    NOT NULL,
  action     TEXT    NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  actor_id   TEXT,
  before_json TEXT,
  after_json  TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_row_ts
  ON billing_audit_log (table_name, row_id, created_at);

-- ── tier_change_events: CHECK constraint on tier enum columns ─────────────────
-- D1 (SQLite) does NOT support ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS.
-- The enum check must be enforced at app layer (Zod) + new rows use this migration.
-- For a clean schema, recreate the table with constraints on new deployments.
-- On existing deployments: app-layer validation via Zod is the fallback guard.
--
-- NOTE: SQLite CHECK constraints on existing tables require recreating the table.
-- We DO NOT recreate here to avoid data loss risk in production.
-- The tier enum values (BASIC|PREMIUM|ENTERPRISE|MASTER) are validated in:
--   src/lib/db/audit/audit-log.ts (TierEnum Zod schema)
--   src/lib/billing/nowpayments-ipn-subscription.ts (Tier type from @/types)
