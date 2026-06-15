-- Migration: 0122_openclaw_token_security
-- Purpose: Support JTI revocation + mint rate-limiting for OpenClaw exchange tokens
-- Applied: 2026-05-22

-- JTI revocation table.
-- Verifier must check this before accepting any exchange token.
CREATE TABLE IF NOT EXISTS openclaw_revoked_tokens (
  jti TEXT PRIMARY KEY,
  revoked_at INTEGER NOT NULL,  -- Unix epoch seconds
  reason TEXT
);

-- Index for fast bulk-cleanup queries.
CREATE INDEX IF NOT EXISTS idx_openclaw_revoked_tokens_revoked_at
  ON openclaw_revoked_tokens (revoked_at);

-- Mint attempt tracking for per-user + per-IP rate limiting.
-- One row per mint attempt; old rows pruned by TTL queries (>1h).
CREATE TABLE IF NOT EXISTS openclaw_mint_attempts (
  jti TEXT PRIMARY KEY,         -- links back to the minted token
  user_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at INTEGER NOT NULL   -- Unix epoch seconds
);

CREATE INDEX IF NOT EXISTS idx_openclaw_mint_attempts_user_id_created_at
  ON openclaw_mint_attempts (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_openclaw_mint_attempts_ip_created_at
  ON openclaw_mint_attempts (ip, created_at);
