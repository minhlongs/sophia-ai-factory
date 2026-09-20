-- Migration: 0280_customer_handover_acceptance
-- Phase 20: 100/100 Automated Customer Handover, Project Closeout & Operational Acceptance Engine
-- Sequentially follows 0279_enterprise_outbound_webhooks.sql

-- ============================================================================
-- 1. PRE-FLIGHT PRAGMA IDEMPOTENCY CHECKS
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;

-- ============================================================================
-- 2. EXTEND TABLE: customer_handovers
-- Description: Add digital acceptance sign-off, cryptographic certificate hash,
-- verification run results, and signer audit metadata.
-- ============================================================================

ALTER TABLE customer_handovers ADD COLUMN acceptance_status TEXT DEFAULT 'pending' 
  CHECK (acceptance_status IN ('pending', 'accepted', 'rejected'));

ALTER TABLE customer_handovers ADD COLUMN signer_name TEXT;
ALTER TABLE customer_handovers ADD COLUMN signer_email TEXT;
ALTER TABLE customer_handovers ADD COLUMN signer_role TEXT DEFAULT 'CEO';
ALTER TABLE customer_handovers ADD COLUMN certificate_hash TEXT;
ALTER TABLE customer_handovers ADD COLUMN verification_results TEXT; -- JSON serialized CheckResults
ALTER TABLE customer_handovers ADD COLUMN signed_at INTEGER;        -- Unix epoch ms
ALTER TABLE customer_handovers ADD COLUMN verification_passed_at INTEGER; -- Unix epoch ms
ALTER TABLE customer_handovers ADD COLUMN certificate_r2_key TEXT;
ALTER TABLE customer_handovers ADD COLUMN tenant_id TEXT;
ALTER TABLE customer_handovers ADD COLUMN notes TEXT;

-- ============================================================================
-- 3. TABLE: handover_certificates
-- Description: Immutable cryptographic archival of generated acceptance certificates.
-- ============================================================================

CREATE TABLE IF NOT EXISTS handover_certificates (
  id TEXT PRIMARY KEY DEFAULT ('cert_' || lower(hex(randomblob(12)))),
  handover_id TEXT NOT NULL UNIQUE REFERENCES customer_handovers(id) ON DELETE CASCADE,
  tenant_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_role TEXT NOT NULL,
  tier TEXT NOT NULL,
  deployed_sha TEXT NOT NULL,
  certificate_sha256 TEXT NOT NULL,
  verification_results TEXT,
  content_markdown TEXT NOT NULL,
  metadata_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE, ACCEPTANCE & CERTIFICATE VERIFICATION
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_customer_handovers_acceptance_status 
  ON customer_handovers(acceptance_status);

CREATE INDEX IF NOT EXISTS idx_customer_handovers_certificate_hash 
  ON customer_handovers(certificate_hash);

CREATE INDEX IF NOT EXISTS idx_customer_handovers_signed_at 
  ON customer_handovers(signed_at);

CREATE INDEX IF NOT EXISTS idx_handover_certificates_handover_id 
  ON handover_certificates(handover_id);

CREATE INDEX IF NOT EXISTS idx_handover_certificates_hash 
  ON handover_certificates(certificate_sha256);

CREATE INDEX IF NOT EXISTS idx_handover_certificates_tenant_id 
  ON handover_certificates(tenant_id);
