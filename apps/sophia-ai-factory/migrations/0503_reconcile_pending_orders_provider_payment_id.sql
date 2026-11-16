-- 0503_reconcile_pending_orders_provider_payment_id.sql
-- Reconciles missing provider_payment_id column on pending_orders caused by historical
-- baseline ledger insertion (0118_d1_migrations_baseline.sql recorded 0187 as applied
-- without executing its DDL). Split from index creation so guard_add_column can safely
-- inspect and skip if already present on an environment.

ALTER TABLE pending_orders ADD COLUMN provider_payment_id TEXT;
