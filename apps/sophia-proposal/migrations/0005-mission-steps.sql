-- Migration: Add mission_steps table for SSE step tracking
CREATE TABLE IF NOT EXISTS mission_steps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  output TEXT,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mission_steps_mission_id ON mission_steps(mission_id);
