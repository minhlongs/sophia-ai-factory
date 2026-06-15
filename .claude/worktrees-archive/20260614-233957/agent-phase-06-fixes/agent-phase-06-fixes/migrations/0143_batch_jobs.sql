-- Batch Video Generation: job tracking + per-video status
CREATE TABLE IF NOT EXISTS batch_jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  total_videos INTEGER NOT NULL,
  completed_videos INTEGER DEFAULT 0,
  failed_videos INTEGER DEFAULT 0,
  estimated_cost_cents INTEGER DEFAULT 0,
  actual_cost_cents INTEGER DEFAULT 0,
  input_r2_key TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_user_id ON batch_jobs(user_id);

CREATE TABLE IF NOT EXISTS batch_videos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  batch_id TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  status TEXT DEFAULT 'queued',
  mission_id TEXT,
  input_data TEXT NOT NULL,
  output_video_url TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (batch_id) REFERENCES batch_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_batch_videos_batch_id ON batch_videos(batch_id);
