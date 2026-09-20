-- Migration: 0277_enterprise_org_invitations
-- Phase 18–19: Enterprise Multi-User Organizations & Invitations
-- Sequentially follows 0276_enterprise_scale_foundations.sql

-- ============================================================================
-- 1. PRE-FLIGHT PRAGMA IDEMPOTENCY CHECKS
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;

-- ============================================================================
-- 2. TABLE: org_invitations
-- Description: Cryptographic single-use invitations for multi-user organizations.
-- Conforms to 5-Tier RBAC, 7-day TTL, and SHA-256 hash storage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_invitations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN ('owner', 'admin', 'creator', 'billing_manager', 'viewer')
  ),
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER DEFAULT NULL,
  created_by TEXT NOT NULL,
  invited_by TEXT GENERATED ALWAYS AS (created_by) VIRTUAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'revoked', 'expired')
  )
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE & INTEGRITY
-- ============================================================================

-- 1. Fast, timing-safe lookup by SHA-256 token hash (Acceptance critical path)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_org_invitations_token_hash 
  ON org_invitations(token_hash);

-- 2. Quota check & member list query: filtering by org and status
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_status 
  ON org_invitations(org_id, status);

-- 3. Inbound invite lookup & deduplication by email
CREATE INDEX IF NOT EXISTS idx_org_invitations_email 
  ON org_invitations(email);

-- 4. TTL cleanup & expiration sweeps
CREATE INDEX IF NOT EXISTS idx_org_invitations_expires_at 
  ON org_invitations(expires_at);

-- 5. Partial unique index: Prevent multiple concurrent pending invitations for the same email in the same org
CREATE UNIQUE INDEX IF NOT EXISTS uidx_org_invitations_active_email 
  ON org_invitations(org_id, email) 
  WHERE status = 'pending';

-- ============================================================================
-- 4. COMPATIBILITY VIEW
-- Supports dual querying for organization_invitations and org_invitations
-- ============================================================================

CREATE VIEW IF NOT EXISTS organization_invitations AS 
  SELECT * FROM org_invitations;
