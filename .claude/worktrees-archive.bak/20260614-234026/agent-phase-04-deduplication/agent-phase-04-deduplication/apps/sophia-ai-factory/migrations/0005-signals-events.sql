-- Sophia AI Factory D1 Signal Layer
-- Founder-owned telemetry table — source of truth for ops/weekly digest
-- DB binding: sophia-raas-db

CREATE TABLE IF NOT EXISTS signals_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,                      -- unix ms
  event_type  TEXT    NOT NULL,                      -- one of D1Events enum
  actor       TEXT    NOT NULL,                      -- userId | 'system' | 'cron' | 'webhook'
  org_id      TEXT,                                  -- nullable; FK loosely to org_members.org_id
  props_json  TEXT    NOT NULL DEFAULT '{}'          -- serialized JSON, validated by Zod before insert
);

CREATE INDEX IF NOT EXISTS idx_signals_events_ts          ON signals_events (ts);
CREATE INDEX IF NOT EXISTS idx_signals_events_type_ts     ON signals_events (event_type, ts);
CREATE INDEX IF NOT EXISTS idx_signals_events_org_ts      ON signals_events (org_id, ts);
