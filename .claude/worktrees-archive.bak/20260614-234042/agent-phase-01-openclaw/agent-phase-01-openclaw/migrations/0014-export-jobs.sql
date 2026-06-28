-- Usage export job tracking (replaces Supabase export_jobs)
-- Schema matches cron/usage-export/route.ts storeExportReceipt INSERT shape:
--   id, license_nonce, record_count, export_format, period_start, period_end,
--   success, error_message, created_at
-- org_id kept as optional FK for future multi-tenant queries.
CREATE TABLE IF NOT EXISTS export_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  license_nonce TEXT NOT NULL,           -- raas_licenses.nonce
  export_format TEXT NOT NULL DEFAULT 'json',  -- 'json' | 'csv'
  period_start INTEGER NOT NULL,         -- Unix seconds (start of export window)
  period_end INTEGER NOT NULL,           -- Unix seconds (end of export window)
  record_count INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 0,    -- SQLite boolean: 1=true, 0=false
  error_message TEXT,
  created_at INTEGER NOT NULL            -- Unix seconds (set by route.ts)
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_nonce ON export_jobs(license_nonce);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created ON export_jobs(created_at);
