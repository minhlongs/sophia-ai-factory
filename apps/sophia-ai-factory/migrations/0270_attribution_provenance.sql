-- Migration 0270: media_jobs revenue attribution provenance
-- SUPREME COMMAND #10 — Phase 1
-- Idempotent link between a media_job and the revenue event that
-- funded it. One provenance row per (media_job_id, source_event_id).
-- Re-runs are no-ops: INSERT OR IGNORE on the PK.

CREATE TABLE IF NOT EXISTS attribution_provenance (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  media_job_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL,        -- performance_events.id (e.g. conv_*, rev_*)
  source_type TEXT NOT NULL,            -- 'conversion' | 'revenue'  (performance_events.event_type)
  channel TEXT NOT NULL,                -- 'tiktok' | 'youtube'      (performance_events.channel)
  attributed_amount_cents INTEGER NOT NULL, -- value_cents at time of attribution
  attribution_rule TEXT NOT NULL,       -- 'last-touch-within-window'
  attribution_window_days INTEGER NOT NULL DEFAULT 30,
  job_completed_at INTEGER,             -- media_jobs.completed_at (ms)
  revenue_recorded_at INTEGER,          -- performance_events.recorded_at (ms)
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
  UNIQUE(media_job_id, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_attprov_job ON attribution_provenance(media_job_id);
CREATE INDEX IF NOT EXISTS idx_attprov_event ON attribution_provenance(source_event_id);
CREATE INDEX IF NOT EXISTS idx_attprov_created ON attribution_provenance(created_at DESC);
