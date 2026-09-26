-- Migration 0300: Global Enterprise Sovereign Cloud Federation & Cryptographic Compliance Vault
-- Supports Milestone $800k MRR: Sovereign Data Residency, CMEK Envelope Encryption, Right-to-be-Forgotten & Erasure Certificates
-- Cloudflare D1 SQLite standards: Millisecond Unix timestamps, strict CHECK constraints, and foreign key cascades.

-- ============================================================================
-- 1. sovereign_data_zones
-- Description: Registry of sovereign jurisdictions, compliance policies & storage regions.
-- ============================================================================
CREATE TABLE IF NOT EXISTS sovereign_data_zones (
  id TEXT PRIMARY KEY,
  zone_code TEXT NOT NULL UNIQUE CHECK(zone_code IN ('EU', 'VN', 'APAC_SG', 'APAC_JP', 'US', 'GLOBAL')),
  name TEXT NOT NULL,
  jurisdiction_legal_name TEXT NOT NULL,
  regulatory_framework TEXT NOT NULL CHECK(regulatory_framework IN ('EU_GDPR', 'VN_PDPD', 'SG_PDPA', 'JP_APPI', 'US_CCPA', 'MULTI_JURISDICTION')),
  primary_storage_region TEXT NOT NULL,
  fallback_storage_region TEXT,
  cross_border_transfer_policy TEXT NOT NULL DEFAULT 'adequacy_only' CHECK(cross_border_transfer_policy IN ('strictly_prohibited', 'adequacy_only', 'explicit_consent_scc', 'unrestricted')),
  mandatory_cmek INTEGER NOT NULL DEFAULT 0 CHECK(mandatory_cmek IN (0, 1)),
  retention_period_days INTEGER NOT NULL DEFAULT 2555, -- 7 years standard
  audit_retention_days INTEGER NOT NULL DEFAULT 2555,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_sdz_zone_code ON sovereign_data_zones(zone_code);
CREATE INDEX IF NOT EXISTS idx_sdz_framework ON sovereign_data_zones(regulatory_framework);
CREATE INDEX IF NOT EXISTS idx_sdz_active ON sovereign_data_zones(is_active);

-- Seed Canonical Sovereign Zones
INSERT OR IGNORE INTO sovereign_data_zones (
  id, zone_code, name, jurisdiction_legal_name, regulatory_framework,
  primary_storage_region, fallback_storage_region, cross_border_transfer_policy, mandatory_cmek
) VALUES 
  ('zone_eu_gdpr', 'EU', 'European Sovereign Data Zone', 'European Economic Area (GDPR)', 'EU_GDPR', 'weur', 'eeur', 'adequacy_only', 1),
  ('zone_vn_pdpd', 'VN', 'Vietnam Sovereign Residency Zone', 'Socialist Republic of Vietnam (Decree 13 & CyberLaw)', 'VN_PDPD', 'apac-vn', 'apac-sg', 'strictly_prohibited', 1),
  ('zone_sg_pdpa', 'APAC_SG', 'Singapore APRA/PDPA Zone', 'Republic of Singapore (PDPA 2012)', 'SG_PDPA', 'apac-sg', 'apac-jp', 'explicit_consent_scc', 0),
  ('zone_jp_appi', 'APAC_JP', 'Japan Sovereign Privacy Zone', 'Japan (Act on the Protection of Personal Information)', 'JP_APPI', 'apac-jp', 'apac-sg', 'adequacy_only', 0),
  ('zone_us_ccpa', 'US', 'United States Commercial & CCPA Zone', 'United States of America (CCPA/CPRA)', 'US_CCPA', 'wnam', 'enam', 'unrestricted', 0),
  ('zone_global_default', 'GLOBAL', 'Global Cross-Regional Default Zone', 'International Common Law', 'MULTI_JURISDICTION', 'auto', NULL, 'unrestricted', 0);

-- ============================================================================
-- 2. tenant_sovereign_keys
-- Description: Customer-Managed Encryption Key (CMEK) & Envelope KEK/DEK Registry.
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_sovereign_keys (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  zone_id TEXT NOT NULL REFERENCES sovereign_data_zones(id),
  key_alias TEXT NOT NULL,
  key_type TEXT NOT NULL CHECK(key_type IN ('platform_managed_isolated', 'cmek_byok_raw', 'cmek_aws_kms', 'cmek_gcp_kms', 'cmek_vault')),
  algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
  key_version INTEGER NOT NULL DEFAULT 1,
  wrapped_dek_ciphertext TEXT NOT NULL,       -- Base64 wrapped Data Encryption Key
  dek_iv_base64 TEXT NOT NULL,                -- 12-byte IV used to wrap the DEK
  kek_reference_or_fingerprint TEXT NOT NULL, -- SHA-256 fingerprint or external Key ARN
  key_state TEXT NOT NULL DEFAULT 'active' CHECK(key_state IN ('active', 'suspended', 'revoked', 'compromised', 'destroyed')),
  rotation_interval_days INTEGER NOT NULL DEFAULT 90,
  last_rotated_at INTEGER,
  next_rotation_due_at INTEGER,
  revoked_at INTEGER,
  revocation_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(org_id, key_alias, key_version)
);

CREATE INDEX IF NOT EXISTS idx_tsk_org_state ON tenant_sovereign_keys(org_id, key_state);
CREATE INDEX IF NOT EXISTS idx_tsk_zone ON tenant_sovereign_keys(zone_id);
CREATE INDEX IF NOT EXISTS idx_tsk_rotation ON tenant_sovereign_keys(key_state, next_rotation_due_at);
CREATE INDEX IF NOT EXISTS idx_tsk_fingerprint ON tenant_sovereign_keys(kek_reference_or_fingerprint);

-- ============================================================================
-- 3. compliance_audit_logs
-- Description: Tamper-evident cryptographic hash-chained sovereign compliance audit vault.
-- Formula: content_hash = sha256(prev_hash + timestamp + zone + org + actor + action + payload)
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_audit_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  zone_id TEXT NOT NULL REFERENCES sovereign_data_zones(id),
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('user', 'api_key', 'system', 'external_auditor')),
  actor_ip_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  jurisdiction_compliance TEXT NOT NULL CHECK(jurisdiction_compliance IN ('EU_GDPR', 'VN_PDPD', 'SG_PDPA', 'JP_APPI', 'US_CCPA', 'GLOBAL')),
  policy_verdict TEXT NOT NULL CHECK(policy_verdict IN ('ALLOWED', 'DENIED', 'AUDITED', 'ENFORCED')),
  payload_canonical_json TEXT NOT NULL DEFAULT '{}',
  prev_hash TEXT,
  content_hash TEXT NOT NULL,
  digital_signature TEXT,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_cal_org_ts ON compliance_audit_logs(org_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cal_zone_ts ON compliance_audit_logs(zone_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cal_action ON compliance_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_cal_content_hash ON compliance_audit_logs(content_hash);
CREATE INDEX IF NOT EXISTS idx_cal_prev_hash ON compliance_audit_logs(prev_hash);

-- ============================================================================
-- 4. erasure_certificates
-- Description: Automated cryptographic certificates of erasure (GDPR Art 17 & VN PDPD).
-- ============================================================================
CREATE TABLE IF NOT EXISTS erasure_certificates (
  id TEXT PRIMARY KEY,
  certificate_number TEXT NOT NULL UNIQUE,
  org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  subject_id_pseudonym TEXT NOT NULL,
  jurisdiction TEXT NOT NULL CHECK(jurisdiction IN ('EU_GDPR', 'VN_PDPD', 'SG_PDPA', 'JP_APPI', 'US_CCPA')),
  legal_basis TEXT NOT NULL,
  erasure_method TEXT NOT NULL CHECK(erasure_method IN ('crypto_shredding', 'physical_overwrite', 'anonymization_and_redaction', 'hybrid_shred_and_redact')),
  shredded_key_fingerprint TEXT,
  affected_records_count INTEGER NOT NULL DEFAULT 0,
  records_manifest_hash TEXT NOT NULL, -- SHA-256 Merkle root of deleted record identifiers
  verifier_public_key_id TEXT NOT NULL,
  digital_signature TEXT NOT NULL,    -- Non-repudiation cryptographic signature
  issued_at INTEGER NOT NULL,
  certificate_pdf_url TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_ec_cert_num ON erasure_certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_ec_subject ON erasure_certificates(subject_id_pseudonym);
CREATE INDEX IF NOT EXISTS idx_ec_org_issued ON erasure_certificates(org_id, issued_at DESC);
