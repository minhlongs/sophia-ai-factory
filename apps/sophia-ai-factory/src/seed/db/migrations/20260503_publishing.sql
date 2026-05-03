-- Migration: publishing pipeline tables
-- Phase 10: Multi-Channel Publisher (TikTok / YouTube / Instagram)
-- Round 2 updates:
--   C2: align publishing_results columns with TS interface
--   C6: add channel_quotas for atomic D1 quota
--   C7: add refreshing_at for row-lock on token refresh
--   Enum: 'suspended' -> 'expired'

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
  status TEXT NOT NULL CHECK(status IN ('active','disconnected','expired')) DEFAULT 'active',
  refreshing_at INTEGER,
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

-- publishing_results: TEXT id (uuid), publishing_job_id, published_at — match TS interface
CREATE TABLE IF NOT EXISTS publishing_results (
  id TEXT PRIMARY KEY,
  publishing_job_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  channel_post_id TEXT,
  post_url TEXT,
  metrics_json TEXT,
  published_at INTEGER NOT NULL,
  FOREIGN KEY (publishing_job_id) REFERENCES publishing_jobs(id)
);

-- Atomic D1 quota — replaces KV TOCTOU (C6)
CREATE TABLE IF NOT EXISTS channel_quotas (
  channel_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  day TEXT NOT NULL,
  daily_limit INTEGER NOT NULL,
  used_today INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, day)
);

CREATE INDEX IF NOT EXISTS idx_pub_channels_tenant ON publishing_channels(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_pub_jobs_status_sched ON publishing_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_pub_jobs_tenant ON publishing_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pub_results_job ON publishing_results(publishing_job_id);
CREATE INDEX IF NOT EXISTS idx_channel_quotas_day ON channel_quotas(day);
