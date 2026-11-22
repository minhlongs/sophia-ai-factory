-- Track B1.1: Durable D1 state for BASIC First-Value Journey reviews.
-- Additive migration; enforces tenant ownership and cross-isolate idempotency
-- via UNIQUE(org_id, user_id, idempotency_key) and optimistic version locking.

CREATE TABLE IF NOT EXISTS first_value_reviews (
  artifact_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  provenance TEXT NOT NULL CHECK (provenance IN ('fixture_simulated', 'live_provider')),
  provenance_label TEXT NOT NULL,
  review_state TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (review_state IN ('pending_review', 'accepted', 'rejected')),
  version INTEGER NOT NULL DEFAULT 1,
  topic TEXT NOT NULL,
  audience TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  script_json TEXT NOT NULL,
  private_artifact_ref TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  mcu_accounting_ref TEXT,
  mcu_charged INTEGER NOT NULL DEFAULT 0,
  accepted_at_iso TEXT,
  accepted_by_user_id TEXT,
  rejected_at_iso TEXT,
  rejection_reason TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  UNIQUE (org_id, user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_first_value_reviews_org_user_created
  ON first_value_reviews (org_id, user_id, created_at_iso DESC);

CREATE INDEX IF NOT EXISTS idx_first_value_reviews_org_artifact
  ON first_value_reviews (org_id, artifact_id);
