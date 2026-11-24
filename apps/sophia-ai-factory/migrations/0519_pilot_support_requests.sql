-- Durable support and data-deletion request queue for isolated private pilot deployments.
-- Strictly scoped by (org_id, user_id) for tenant isolation without storing duplicate PII.

CREATE TABLE IF NOT EXISTS pilot_support_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('support', 'data_deletion')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'completed')),
  operator_note TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  resolved_at_iso TEXT
);

CREATE INDEX IF NOT EXISTS idx_pilot_support_requests_org_user_created
  ON pilot_support_requests (org_id, user_id, created_at_iso DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_support_requests_status_created
  ON pilot_support_requests (status, created_at_iso ASC);
