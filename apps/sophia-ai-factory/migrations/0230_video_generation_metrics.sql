-- Video Generation Performance Baseline (Task #15)
-- Records latency per step + overall for the AI video workflow.
CREATE TABLE IF NOT EXISTS video_generation_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id TEXT NOT NULL,
  user_id TEXT,
  tier TEXT CHECK(tier IN ('BASIC','PREMIUM','ENTERPRISE','MASTER')),
  step TEXT NOT NULL,               -- 'tts' | 'video-submit' | 'poll-ready' | 'download' | 'mux' | 'total'
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT CHECK(status IN ('success','failed','skipped')) DEFAULT 'success',
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vgm_mission ON video_generation_metrics(mission_id);
CREATE INDEX IF NOT EXISTS idx_vgm_step_created ON video_generation_metrics(step, created_at);
