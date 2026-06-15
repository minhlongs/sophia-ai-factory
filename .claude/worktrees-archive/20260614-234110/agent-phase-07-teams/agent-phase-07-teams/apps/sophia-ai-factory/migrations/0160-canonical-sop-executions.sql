-- Canonical SOP Execution Table Migration
-- Decision: sop_executions is the single source of truth.
-- sop_runs is preserved as historical (read-only after this migration).
-- Adds columns missing from sop_executions that exist in sop_runs.

-- 1. Add missing columns to sop_executions
ALTER TABLE sop_executions ADD COLUMN trigger_type TEXT DEFAULT 'manual' CHECK(trigger_type IN ('cron','webhook','manual'));
ALTER TABLE sop_executions ADD COLUMN mission_ids TEXT DEFAULT '[]';
ALTER TABLE sop_executions ADD COLUMN result_summary TEXT;
ALTER TABLE sop_executions ADD COLUMN requires_approval INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sop_executions ADD COLUMN created_at INTEGER;

-- 2. Backfill created_at from started_at where missing
UPDATE sop_executions SET created_at = started_at WHERE created_at IS NULL;

-- 3. Backfill trigger_type based on context (default 'manual' for existing rows)
UPDATE sop_executions SET trigger_type = 'manual' WHERE trigger_type IS NULL;

-- 4. Backfill mission_ids as empty JSON array for existing rows
UPDATE sop_executions SET mission_ids = '[]' WHERE mission_ids IS NULL;

-- 5. Index for new query patterns
CREATE INDEX IF NOT EXISTS idx_sop_exec_installation ON sop_executions(installation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sop_exec_status_created ON sop_executions(status, created_at DESC);
