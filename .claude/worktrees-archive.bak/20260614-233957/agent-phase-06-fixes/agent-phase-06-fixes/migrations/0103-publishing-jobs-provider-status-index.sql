-- Wave 22 Phase 04 — Composite index on publishing_jobs(provider, status)
-- Optimizes hot filter `WHERE provider='telegram' AND status=...` used by
-- Inngest token-refresh cron + publish-execute job lookups.
-- Pre-emptive scaling fix for >10K rows; idempotent (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_pub_jobs_provider_status
  ON publishing_jobs(provider, status);
