-- Migration 0290: Video Render Jobs Queue & Fair-Share GPU Mesh Scheduler
-- Milestone 4 — Enterprise Scale Engine (Distributed Batch Queue & Fair-Share GPU Mesh Scheduler)

CREATE TABLE IF NOT EXISTS video_render_jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subaccount_id TEXT,
  lane TEXT NOT NULL DEFAULT 'standard' CHECK (lane IN ('priority', 'standard')),
  priority_score INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'leased', 'rendering', 'completed', 'failed', 'dlq')),
  tier TEXT NOT NULL,
  payload TEXT NOT NULL,
  result_url TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  leased_by TEXT,
  leased_until INTEGER,
  provider TEXT CHECK (provider IN ('fal', 'runpod', 'replicate', 'mekong')),
  dlq_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_vrj_lane_status_priority ON video_render_jobs(lane, status, priority_score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_vrj_org_status ON video_render_jobs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_vrj_leased_until ON video_render_jobs(leased_until);
CREATE INDEX IF NOT EXISTS idx_vrj_subaccount ON video_render_jobs(subaccount_id);
