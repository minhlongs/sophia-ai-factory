-- CUSTOMER-01: First Real Customer Pilot — Isolated Pilot State Tables
-- Applies ONLY to the isolated non-production pilot D1 database (`sophia-pilot-db`).
-- Strictly scoped by (org_id, user_id) for tenant isolation.

CREATE TABLE IF NOT EXISTS pilot_consents (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  accepted_at_iso TEXT NOT NULL,
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS pilot_usage_quotas (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  used_generations INTEGER NOT NULL DEFAULT 0,
  last_generation_at_iso TEXT,
  last_generation_at_ms INTEGER,
  updated_at_iso TEXT NOT NULL,
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS pilot_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  artifact_id TEXT,
  metadata_json TEXT,
  created_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pilot_events_org_user_created
  ON pilot_events (org_id, user_id, created_at_iso DESC);

CREATE TABLE IF NOT EXISTS pilot_feedback (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  artifact_id TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  category TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_org_user_created
  ON pilot_feedback (org_id, user_id, created_at_iso DESC);
