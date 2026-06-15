-- Migration 0006: Add per-user local-mode BYOK columns to users table
-- Phase B: Customer BYOK Provider Router
--
-- local_mode_endpoint: plain URL to user's mekongd tunnel (no PII)
-- local_mode_bearer_encrypted: AES-256-GCM ciphertext from encrypt-secret.ts
--   NEVER store raw bearer token — always go through encryptSecret() at write time

ALTER TABLE users ADD COLUMN local_mode_endpoint TEXT;
ALTER TABLE users ADD COLUMN local_mode_bearer_encrypted TEXT;

-- Index for fast lookup — only non-null rows need routing consideration
CREATE INDEX IF NOT EXISTS idx_users_local_mode_endpoint ON users(local_mode_endpoint)
  WHERE local_mode_endpoint IS NOT NULL;
