-- Migration: 0029 - MFA pending sessions table
-- Created: 2026-04-28
-- Purpose: Track sessions awaiting MFA verification after password login

CREATE TABLE IF NOT EXISTS mfa_pending_sessions (
  session_id  TEXT     NOT NULL PRIMARY KEY,
  expires_at  INTEGER  NOT NULL,
  created_at  INTEGER  NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mfa_pending_expires ON mfa_pending_sessions(expires_at);
