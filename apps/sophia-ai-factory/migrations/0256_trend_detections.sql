-- Migration: 0256_trend_detections
-- Phase 2: Creative Intelligence — cross-channel trend detection output.
-- Rows written by tree/trend-intelligence detect pipeline. Fully additive.

CREATE TABLE IF NOT EXISTS trend_detections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  channel TEXT,
  momentum REAL NOT NULL DEFAULT 0,
  forecast TEXT,                    -- JSON: projected trajectory + confidence interval
  evidence_ids TEXT,                -- JSON array of market_signals/performance_events ids
  detected_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_trend_detections_workspace
  ON trend_detections(workspace_id, detected_at DESC);
