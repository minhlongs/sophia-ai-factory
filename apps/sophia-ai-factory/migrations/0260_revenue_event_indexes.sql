-- Revenue event query index for performance_events.
--
-- Supports the revenue ingestion read paths (dashboard revenue card,
-- revenue-event lookups filtered by event_type + workspace + time window).
--
-- Note: performance_events has no user_id column (table is workspace-scoped),
-- so the composite index uses workspace_id instead. Does not duplicate the
-- existing idx_perf_events_type(event_type, recorded_at DESC).
CREATE INDEX IF NOT EXISTS idx_perf_events_type_workspace
  ON performance_events(event_type, workspace_id, recorded_at);
