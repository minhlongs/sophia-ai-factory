-- Migration 0097: Add BYOK model columns to missions
-- D1 does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- Use separate statements; apply-migrations.sh handles idempotency via
-- the supabase_migrations_applied tracking table.

ALTER TABLE missions ADD COLUMN byok_provider_id TEXT;
ALTER TABLE missions ADD COLUMN byok_model_id TEXT;

CREATE INDEX IF NOT EXISTS idx_missions_byok
  ON missions(byok_provider_id, byok_model_id)
  WHERE byok_provider_id IS NOT NULL;
