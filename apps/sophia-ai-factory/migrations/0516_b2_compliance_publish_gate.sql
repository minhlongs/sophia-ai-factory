-- Track B2: Durable D1 ledger for Compliance Publish Gate (MOCK_ONLY).
-- Additive migration; keeps legacy publish_ledger untouched.
-- Enforces tenant scoping, idempotency, single-use approval nonce, optimistic locking,
-- server-only MOCK_ONLY publication_mode, and forbids real-world PUBLISHED status.

CREATE TABLE IF NOT EXISTS b2_publish_gate_requests (
  request_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  media_artifact_id TEXT NOT NULL,
  media_content_digest TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'youtube', 'instagram')),
  destination_account_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  publication_mode TEXT NOT NULL DEFAULT 'MOCK_ONLY' CHECK (publication_mode = 'MOCK_ONLY'),
  state TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    state IN (
      'DRAFT',
      'PREFLIGHT_REQUIRED',
      'PREFLIGHT_BLOCKED',
      'READY_FOR_REVIEW',
      'AWAITING_HUMAN_APPROVAL',
      'APPROVED',
      'REJECTED',
      'APPROVAL_EXPIRED',
      'MOCK_EXECUTION_CLAIMED',
      'SIMULATED_PUBLISHED',
      'SIMULATED_FAILED',
      'RECONCILIATION_REQUIRED'
    )
  ),
  version INTEGER NOT NULL DEFAULT 1,
  approval_version INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL,
  payload_digest_sha256 TEXT NOT NULL,
  capability_snapshot_json TEXT,
  compliance_json TEXT NOT NULL,
  approval_nonce TEXT,
  approval_nonce_used_at_iso TEXT,
  approval_expires_at_iso TEXT,
  approved_by_user_id TEXT,
  approved_at_iso TEXT,
  rejection_reason TEXT,
  execution_claim_id TEXT,
  mock_receipt_json TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  UNIQUE (org_id, idempotency_key),
  UNIQUE (org_id, approval_nonce)
);

CREATE INDEX IF NOT EXISTS idx_b2_publish_gate_org_created
  ON b2_publish_gate_requests (org_id, created_at_iso DESC);

CREATE INDEX IF NOT EXISTS idx_b2_publish_gate_org_state
  ON b2_publish_gate_requests (org_id, state);

CREATE TABLE IF NOT EXISTS b2_publish_gate_events (
  event_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reason_code TEXT,
  payload_digest_sha256 TEXT NOT NULL,
  metadata_json TEXT,
  created_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_b2_publish_gate_events_req
  ON b2_publish_gate_events (org_id, request_id, created_at_iso ASC);
