-- Migration: publishing pipeline tables
-- Phase 10: Multi-Channel Publisher (TikTok / YouTube / Instagram)

CREATE TABLE IF NOT EXISTS publishing_channels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('tiktok','youtube','instagram')),
  external_account_id TEXT NOT NULL,
  display_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER,
  status TEXT NOT NULL CHECK(status IN ('active','disconnected','suspended')) DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(tenant_id, provider, external_account_id)
);

CREATE TABLE IF NOT EXISTS publishing_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  video_job_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('scheduled','uploading','processing','live','failed')),
  caption TEXT,
  hashtags_json TEXT,
  product_link TEXT,
  scheduled_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS publishing_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  channel_post_id TEXT,
  post_url TEXT,
  metrics_json TEXT,
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES publishing_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_pub_channels_tenant ON publishing_channels(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_pub_jobs_status_sched ON publishing_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_pub_jobs_tenant ON publishing_jobs(tenant_id, created_at DESC);
