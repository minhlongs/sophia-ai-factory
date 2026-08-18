-- Migration: 0243_performance_events
-- Phase 4: Creative Learning Loop — performance_events table

CREATE TABLE IF NOT EXISTS performance_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  channel TEXT,
  recorded_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_perf_events_workspace ON performance_events(workspace_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_events_entity ON performance_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_perf_events_channel ON performance_events(channel, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_events_type ON performance_events(event_type, recorded_at DESC);