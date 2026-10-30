-- Execution render tracking: bind the provider render job to the run and
-- count submit attempts so a concurrent worker replays the bound job instead
-- of submitting a second render. Additive ALTER, single-apply via the
-- wrangler journal (0477 convention).
ALTER TABLE affiliate_execution_runs ADD COLUMN provider_job_id TEXT;
ALTER TABLE affiliate_execution_runs ADD COLUMN render_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_affiliate_execution_runs_provider_job
  ON affiliate_execution_runs(tenant_id, provider_job_id) WHERE provider_job_id IS NOT NULL;
