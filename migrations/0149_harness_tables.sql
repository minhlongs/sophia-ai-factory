-- Migration: Add Harness Engineering tables

CREATE TABLE IF NOT EXISTS harness_jobs (
  id TEXT PRIMARY KEY,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  triggered_by TEXT CHECK (triggered_by IN ('web', 'telegram', 'scheduler')) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS harness_results (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  test_name TEXT CHECK (test_name IN ('d1_ping', 'r2_storage', 'api_openrouter', 'api_elevenlabs', 'api_heygen', 'remotion_render')) NOT NULL,
  status TEXT CHECK (status IN ('success', 'failed')) NOT NULL,
  duration_ms INTEGER NOT NULL,
  error_message TEXT,
  metadata TEXT, -- JSON string format
  FOREIGN KEY (job_id) REFERENCES harness_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_harness_jobs_status ON harness_jobs(status);
CREATE INDEX IF NOT EXISTS idx_harness_results_job_id ON harness_results(job_id);
