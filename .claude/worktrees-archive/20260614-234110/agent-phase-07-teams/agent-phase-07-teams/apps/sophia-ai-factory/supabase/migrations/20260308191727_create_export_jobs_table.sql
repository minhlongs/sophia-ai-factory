-- Create export_jobs table for tracking usage export cron job receipts
-- Created: 2026-03-08 19:17 UTC
-- Purpose: Store audit trail of automated daily usage exports

CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_nonce VARCHAR(255) NOT NULL REFERENCES raas_licenses(nonce) ON DELETE CASCADE,
  record_count INTEGER NOT NULL DEFAULT 0,
  export_format VARCHAR(10) NOT NULL CHECK (export_format IN ('json', 'csv')),
  period_start BIGINT NOT NULL,
  period_end BIGINT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),

  -- Index for querying by license
  CONSTRAINT fk_export_jobs_license
    FOREIGN KEY (license_nonce)
    REFERENCES raas_licenses(nonce)
    ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_export_jobs_license_nonce ON export_jobs(license_nonce);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at ON export_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_success ON export_jobs(success);

-- Comment for documentation
COMMENT ON TABLE export_jobs IS 'Audit trail for automated daily usage export cron jobs';
COMMENT ON COLUMN export_jobs.id IS 'Unique job identifier';
COMMENT ON COLUMN export_jobs.license_nonce IS 'Reference to the license this export belongs to';
COMMENT ON COLUMN export_jobs.record_count IS 'Number of usage records exported';
COMMENT ON COLUMN export_jobs.export_format IS 'Export format: json or csv';
COMMENT ON COLUMN export_jobs.period_start IS 'Start of export period (Unix timestamp)';
COMMENT ON COLUMN export_jobs.period_end IS 'End of export period (Unix timestamp)';
COMMENT ON COLUMN export_jobs.success IS 'Whether the export succeeded';
COMMENT ON COLUMN export_jobs.error_message IS 'Error details if export failed';
COMMENT ON COLUMN export_jobs.created_at IS 'When the export job was created (Unix timestamp)';

-- RLS (Row Level Security) - optional, enable if needed
-- ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
