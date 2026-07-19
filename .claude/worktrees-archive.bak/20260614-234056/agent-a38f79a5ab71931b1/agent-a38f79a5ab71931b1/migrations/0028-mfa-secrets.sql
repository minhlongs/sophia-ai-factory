-- Migration: 0028 - MFA secrets table for TOTP 2FA
-- Created: 2026-04-29
-- Purpose: Store per-user TOTP secrets and backup codes for optional MFA

CREATE TABLE IF NOT EXISTS mfa_secrets (
  user_id             TEXT        NOT NULL PRIMARY KEY,
  totp_secret_enc     TEXT        NOT NULL,
  totp_enabled        INTEGER     NOT NULL DEFAULT 0,
  backup_codes_json   TEXT,
  recovery_used_at    INTEGER,
  created_at          INTEGER     NOT NULL DEFAULT (unixepoch()),
  updated_at          INTEGER     NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mfa_secrets_user_id ON mfa_secrets(user_id);
