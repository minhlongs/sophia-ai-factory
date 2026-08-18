-- Migration: 0244_roi_tracking
-- Phase 4: Creative Learning Loop — ROI tracking table

CREATE TABLE IF NOT EXISTS roi_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  roi REAL NOT NULL DEFAULT 0,
  channel TEXT,
  recorded_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_roi_workspace ON roi_records(workspace_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_roi_entity ON roi_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_roi_channel ON roi_records(channel, workspace_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_roi_recorded ON roi_records(recorded_at DESC);