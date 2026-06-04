-- Idempotency key for batch job creation (F10)
-- Allows safe retries: if the same idempotency_key is submitted twice,
-- the second request returns the existing batch instead of creating a duplicate.
ALTER TABLE batch_jobs ADD COLUMN idempotency_key TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_batch_jobs_idempotency_key ON batch_jobs(idempotency_key);
