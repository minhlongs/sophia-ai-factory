-- Migration: 0276_enterprise_scale_foundations
-- Phase 18–19: Enterprise Scale Foundations (Custom Domains & Cloudflare for SaaS Verification)
-- Sequentially follows 0275_autonomous_growth_and_revenue.sql

-- ============================================================================
-- 1. PRE-FLIGHT PRAGMA IDEMPOTENCY CHECKS
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;

-- ============================================================================
-- 2. CUSTOM DOMAINS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_domains (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hostname TEXT UNIQUE NOT NULL,
  cf_custom_hostname_id TEXT,
  ssl_status TEXT NOT NULL DEFAULT 'pending_validation' CHECK (
    ssl_status IN ('pending_validation', 'pending_deployment', 'active', 'error', 'revoked')
  ),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    verification_status IN ('pending', 'verified', 'active', 'failed', 'revoked')
  ),
  verification_errors TEXT NOT NULL DEFAULT '[]', -- JSON array of error strings
  ownership_verification TEXT NOT NULL DEFAULT '{}', -- JSON object: { type, name, value }
  ssl_verification TEXT NOT NULL DEFAULT '{}', -- JSON object: { type, name, value }
  cname_target TEXT NOT NULL DEFAULT 'cname.sophia.agencyos.network',
  cname_verified INTEGER NOT NULL DEFAULT 0 CHECK (cname_verified IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================================
-- 3. INDEXES & CONSTRAINTS
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uidx_custom_domains_hostname 
  ON custom_domains(hostname);

CREATE INDEX IF NOT EXISTS idx_custom_domains_org_id 
  ON custom_domains(org_id);

CREATE INDEX IF NOT EXISTS idx_custom_domains_ssl_status 
  ON custom_domains(ssl_status);

CREATE INDEX IF NOT EXISTS idx_custom_domains_active 
  ON custom_domains(active);

CREATE INDEX IF NOT EXISTS idx_custom_domains_cf_id 
  ON custom_domains(cf_custom_hostname_id);
