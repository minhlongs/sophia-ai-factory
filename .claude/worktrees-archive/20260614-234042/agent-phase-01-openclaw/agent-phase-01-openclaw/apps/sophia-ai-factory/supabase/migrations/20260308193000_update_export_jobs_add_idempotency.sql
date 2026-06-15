-- Update export_jobs table with additional columns for idempotency and retry tracking
-- Created: 2026-03-08 19:30 UTC
-- Purpose: Add idempotency key, retry count, and polar response tracking

-- Add new columns if they don't exist
ALTER TABLE export_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS export_date TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS polar_response JSONB,
  ADD COLUMN IF NOT EXISTS customer_id TEXT,
  ADD COLUMN IF NOT EXISTS total_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_requests INTEGER DEFAULT 0;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_export_jobs_idempotency_key ON export_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_export_jobs_export_date ON export_jobs(export_date DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_customer_id ON export_jobs(customer_id);

-- Update comments
COMMENT ON COLUMN export_jobs.idempotency_key IS 'Deterministic key (YYYY-MM-DD) to prevent duplicate exports';
COMMENT ON COLUMN export_jobs.export_date IS 'Date when export was performed (ISO timestamp)';
COMMENT ON COLUMN export_jobs.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN export_jobs.polar_response IS 'Response from Polar.sh API';
COMMENT ON COLUMN export_jobs.customer_id IS 'External customer ID (Polar/Stripe)';
COMMENT ON COLUMN export_jobs.total_credits IS 'Total credits exported';
COMMENT ON COLUMN export_jobs.total_requests IS 'Total requests exported';
