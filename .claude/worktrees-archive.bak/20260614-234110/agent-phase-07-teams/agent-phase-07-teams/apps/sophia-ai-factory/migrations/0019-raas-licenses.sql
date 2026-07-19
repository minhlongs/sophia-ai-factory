-- Migration 0019: raas_licenses + raas_audit_logs tables for D1 (SQLite)
-- Adapted from docs/migrations/raas-licenses-schema.sql (Supabase)
-- No uuid, no gen_random_uuid(), no jsonb, no RLS, no triggers, no BOOLEAN (use INTEGER 0/1)
-- Partial indexes (WHERE clause) require SQLite 3.32+ — supported in Cloudflare D1

CREATE TABLE IF NOT EXISTS raas_licenses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  key_hash TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('BASIC','PREMIUM','ENTERPRISE','MASTER')),
  expires_at INTEGER,               -- Unix seconds; 0/NULL = perpetual
  nonce TEXT NOT NULL UNIQUE,
  is_revoked INTEGER DEFAULT 0,     -- 0 = false, 1 = true (SQLite has no BOOLEAN)
  revoked_at INTEGER,
  revoked_by TEXT REFERENCES users(id),
  created_by TEXT REFERENCES users(id),
  user_id TEXT REFERENCES users(id), -- license owner (NOWPayments activation)
  created_at INTEGER NOT NULL,
  metadata TEXT DEFAULT '{}',        -- JSON-encoded metadata
  updated_at INTEGER,
  -- payment provider customer IDs (NOWPayments primary; kept for Supabase type compat)
  polar_customer_id TEXT,
  stripe_customer_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_key_hash ON raas_licenses(key_hash);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_nonce ON raas_licenses(nonce);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_tier ON raas_licenses(tier);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_user_id ON raas_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_created_by ON raas_licenses(created_by);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_active
  ON raas_licenses(is_revoked, expires_at) WHERE is_revoked = 0;

CREATE TABLE IF NOT EXISTS raas_audit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  action TEXT NOT NULL CHECK (action IN ('CREATE','VALIDATE','REVOKE','UPDATE')),
  license_id TEXT REFERENCES raas_licenses(id),
  license_nonce TEXT,
  user_id TEXT REFERENCES users(id),
  ip_address TEXT,
  user_agent TEXT,
  details TEXT DEFAULT '{}',   -- JSON-encoded details
  created_at INTEGER NOT NULL,
  -- Advanced audit fields (Phase 6 — optional, nullable)
  model_name TEXT,
  token_count INTEGER,
  ip_address_hash TEXT,
  user_pseudonym TEXT
);
CREATE INDEX IF NOT EXISTS idx_raas_audit_license ON raas_audit_logs(license_id);
CREATE INDEX IF NOT EXISTS idx_raas_audit_license_nonce ON raas_audit_logs(license_nonce);
CREATE INDEX IF NOT EXISTS idx_raas_audit_user ON raas_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_raas_audit_action ON raas_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_raas_audit_created ON raas_audit_logs(created_at DESC);
