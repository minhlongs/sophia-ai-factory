-- Migration 0183: Add hash chain columns to raas_audit_logs for SOC 2 immutable audit
-- Phase: 01 - SOC 2 Type I Preparation
-- Adds: previous_log_hash, content_hash, hash_chain_valid columns + indexes
--
-- SOC 2 CC7.2 Requirement: All sensitive operations must have cryptographically
-- verifiable immutable audit trail. This migration extends raas_audit_logs with
-- hash chain fields that create a tamper-evident sequence.
--
-- Columns:
--   previous_log_hash TEXT   — content_hash of the previous log entry (chain link)
--   content_hash TEXT NOT NULL — deterministic hash of log entry data
--   hash_chain_valid INTEGER DEFAULT 1 — integrity flag (0 = broken, 1 = valid)
--
-- Indexes:
--   idx_raas_audit_logs_content_hash  — for hash lookup during verification
--   idx_raas_audit_logs_previous_hash — for gap detection
--   idx_raas_audit_logs_chain_valid  — for filtering invalid entries

-- 1. Add hash chain columns (nullable initially for backfill compatibility)
ALTER TABLE raas_audit_logs ADD COLUMN IF NOT EXISTS previous_log_hash TEXT;
ALTER TABLE raas_audit_logs ADD COLUMN IF NOT EXISTS content_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE raas_audit_logs ADD COLUMN IF NOT EXISTS hash_chain_valid INTEGER DEFAULT 1;  -- SQLite: 0=false, 1=true

-- 2. Indexes for chain verification queries
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_content_hash ON raas_audit_logs(content_hash);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_previous_hash ON raas_audit_logs(previous_log_hash);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_chain_valid ON raas_audit_logs(hash_chain_valid);

-- 3. Migration metadata (D1 convention: record in d1_migrations table for tracking)
-- Note: D1 migrations are tracked separately via `d1_migrations` table created by
-- the migrations system. This comment is informational only.

-- Migration complete: hash chain columns added. Application code (audit logger) is
-- responsible for computing and setting content_hash and previous_log_hash on insert.
-- See: src/tree/audit/audit-logger.ts (computeContentHash, getPreviousHash)
