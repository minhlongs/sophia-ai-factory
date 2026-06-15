-- Migration 0178: idempotency_keys table for refund double-processing guard

-- Stores idempotency keys for refund operations to prevent double-processing.
-- A key is valid for 24 hours from creation.
-- Used by POST /api/admin/refunds/[id]/mark-refunded (FIX-10).

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  refund_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'refunded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
  ON idempotency_keys(expires_at);
