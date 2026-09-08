-- Migration 0269: Creative Economics — economic lifecycle columns on media_jobs
--
-- Adds the minimum economic lifecycle fields required for SUPREME COMMAND #9.
-- All columns nullable to preserve backward compatibility with existing rows.

ALTER TABLE media_jobs ADD COLUMN provider_cost     INTEGER;   -- Cost charged by provider (NULL if UNKNOWN)
ALTER TABLE media_jobs ADD COLUMN cost_currency     TEXT;     -- Currency code, e.g. 'USD'
ALTER TABLE media_jobs ADD COLUMN cost_classification TEXT; -- 'METERED' | 'UNKNOWN' | 'UNMETERED'
ALTER TABLE media_jobs ADD COLUMN revenue_attribution INTEGER; -- Revenue attributed (NULL if UNKNOWN)
ALTER TABLE media_jobs ADD COLUMN gross_margin       INTEGER; -- Gross margin % (NULL if not computable)
ALTER TABLE media_jobs ADD COLUMN error_category    TEXT;   -- AUTH | RATE_LIMIT | TIMEOUT | PROVIDER | VALIDATION | NETWORK | INTERNAL | UNKNOWN
ALTER TABLE media_jobs ADD COLUMN retry_count      INTEGER;   -- Number of retry attempts
ALTER TABLE media_jobs ADD COLUMN requested_at      INTEGER;   -- Timestamp when job requested (unixepoch seconds)
ALTER TABLE media_jobs ADD COLUMN started_at        INTEGER;   -- Timestamp when processing started (unixepoch seconds)

-- Index for economic queries
CREATE INDEX idx_media_jobs_cost_classification ON media_jobs(cost_classification) WHERE cost_classification IS NOT NULL;
CREATE INDEX idx_media_jobs_error_category ON media_jobs(error_category) WHERE error_category IS NOT NULL;
CREATE INDEX idx_media_jobs_provider_cost ON media_jobs(provider_cost) WHERE provider_cost IS NOT NULL;