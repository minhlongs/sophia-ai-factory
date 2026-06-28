-- Migration: video pipeline tables
-- Phase 06: Video Pipeline Foundation

CREATE TABLE IF NOT EXISTS video_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','scripting','tts_pending','visual_pending','composing','uploaded','published','failed')),
  prompt TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  script_text TEXT,
  audio_r2_key TEXT,
  visual_r2_key TEXT,
  final_r2_key TEXT,
  error TEXT,
  cost_usd REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_tenant_status ON video_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_tenant_created ON video_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status_created ON video_jobs(status, created_at);

CREATE TABLE IF NOT EXISTS video_cost_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  provider TEXT NOT NULL,
  units REAL NOT NULL,
  cost_usd REAL NOT NULL,
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES video_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_video_cost_job ON video_cost_log(job_id);
