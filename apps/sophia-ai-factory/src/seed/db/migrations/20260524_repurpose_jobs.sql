-- Migration 20260524: Auto-Repurpose Long→Shorts
-- Creates tables for repurpose jobs and clips

CREATE TABLE IF NOT EXISTS repurpose_jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  source_video_id TEXT NOT NULL,
  status TEXT DEFAULT 'analyzing',
  clip_manifest TEXT,
  total_clips INTEGER DEFAULT 0,
  completed_clips INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS repurpose_clips (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  job_id TEXT NOT NULL,
  clip_index INTEGER NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  score REAL,
  title TEXT,
  status TEXT DEFAULT 'pending',
  output_video_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES repurpose_jobs(id)
);
