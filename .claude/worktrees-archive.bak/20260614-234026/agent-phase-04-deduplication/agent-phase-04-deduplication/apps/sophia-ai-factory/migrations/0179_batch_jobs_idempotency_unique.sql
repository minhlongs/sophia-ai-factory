-- Migration 0179: Add UNIQUE constraint on batch_jobs.idempotency_key
-- Required for idempotent INSERT OR IGNORE to work correctly.
-- Without this constraint, OR IGNORE has no effect (no unique key to conflict on).
CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_jobs_idempotency_key
ON batch_jobs(idempotency_key)
WHERE idempotency_key IS NOT NULL;
