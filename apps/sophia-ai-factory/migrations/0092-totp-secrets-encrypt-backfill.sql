-- Migration: 0092 - TOTP secrets encryption backfill flag
-- Created: 2026-05-09
-- Purpose: Add is_encrypted column to mfa_secrets for lazy AES-256-GCM backfill.
--
-- Strategy: SQL migration adds flag column; app-layer (totp-service.ts) performs
-- actual encryption on next verify call because Workers SQL runtime cannot invoke
-- WebCrypto. Existing rows start as is_encrypted=0 (plaintext) and are upgraded
-- in-place on the first successful TOTP verification.
--
-- Idempotency: Both statements use IF NOT EXISTS / guarded pattern safe to
-- re-run on an already-migrated database.

ALTER TABLE mfa_secrets ADD COLUMN is_encrypted INTEGER NOT NULL DEFAULT 0;

-- Index to find un-encrypted rows efficiently for monitoring / batch tooling.
CREATE INDEX IF NOT EXISTS idx_mfa_secrets_is_encrypted
  ON mfa_secrets(is_encrypted)
  WHERE is_encrypted = 0;
