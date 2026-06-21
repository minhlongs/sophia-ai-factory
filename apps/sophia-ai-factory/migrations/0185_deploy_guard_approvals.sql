-- Deploy Guard Approval Management (Tasks #88, #92, #47)
-- Created: 2026-06-21
-- Purpose: Track deployment approvals, operator attestations, and emergency overrides

-- Main approval tracking table
CREATE TABLE IF NOT EXISTS deploy_guard_approvals (
  id TEXT PRIMARY KEY,
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  operator_host TEXT NOT NULL,
  operator_user TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'overridden')),
  attestation_count INTEGER DEFAULT 0,
  required_attestations INTEGER DEFAULT 2,
  skip_attestation BOOLEAN DEFAULT FALSE,
  skip_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER
);

-- Individual operator attestations (HMAC signatures)
CREATE TABLE IF NOT EXISTS deploy_attestations (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  signature TEXT NOT NULL,
  operator_host TEXT NOT NULL,
  signed_at INTEGER NOT NULL,
  FOREIGN KEY (approval_id) REFERENCES deploy_guard_approvals(id) ON DELETE CASCADE
);

-- Emergency override audit trail
CREATE TABLE IF NOT EXISTS deploy_overrides (
  id TEXT PRIMARY KEY,
  commit_sha TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  approved_by TEXT,
  created_at INTEGER NOT NULL
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_deploy_guard_approvals_status ON deploy_guard_approvals(status);
CREATE INDEX IF NOT EXISTS idx_deploy_guard_approvals_commit ON deploy_guard_approvals(commit_sha);
CREATE INDEX IF NOT EXISTS idx_deploy_guard_approvals_created ON deploy_guard_approvals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deploy_attestations_approval ON deploy_attestations(approval_id);
CREATE INDEX IF NOT EXISTS idx_deploy_attestations_operator ON deploy_attestations(operator_id);

-- Row-level security: All operators with admin role can read/write
-- (application-level checks enforced via requireAdmin middleware)

COMMIT;
