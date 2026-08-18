-- Migration: 0249_learning_velocity
-- Phase 4: Creative Learning Loop — learning_velocity table
-- Tracks how quickly workspaces learn from performance signals

CREATE TABLE IF NOT EXISTS learning_velocity (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  velocity_score REAL NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  window_start_ms INTEGER NOT NULL,
  window_end_ms INTEGER NOT NULL,
  avg_metrics TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_learning_velocity_workspace
  ON learning_velocity(workspace_id, entity_type, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_velocity_score
  ON learning_velocity(velocity_score DESC, workspace_id);
