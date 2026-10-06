-- Migration 0435: AGY Multi-Tenancy & Tenant Isolation
-- Phase: Milestone M1 (Full-Stack AGY Multi-Tenancy)
-- Covers: agy_tenant_configs, agy_tenant_tokens, agy_agency_domains, agy_audit_logs

CREATE TABLE IF NOT EXISTS agy_tenant_configs (
  agency_id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  agency_slug TEXT UNIQUE NOT NULL,
  custom_domain TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deprovisioned')),
  quota_limit_mcu INTEGER NOT NULL DEFAULT 100000,
  quota_used_mcu INTEGER NOT NULL DEFAULT 0,
  rate_limit_rps INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agy_tenant_configs_agency_id ON agy_tenant_configs(agency_id);
CREATE INDEX IF NOT EXISTS idx_agy_tenant_configs_org_id ON agy_tenant_configs(org_id);
CREATE INDEX IF NOT EXISTS idx_agy_tenant_configs_slug ON agy_tenant_configs(agency_slug);
CREATE INDEX IF NOT EXISTS idx_agy_tenant_configs_domain ON agy_tenant_configs(custom_domain);
CREATE INDEX IF NOT EXISTS idx_agy_tenant_configs_status ON agy_tenant_configs(status);

CREATE TABLE IF NOT EXISTS agy_tenant_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  agency_id TEXT NOT NULL REFERENCES agy_tenant_configs(agency_id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  permissions_json TEXT NOT NULL DEFAULT '["read","write"]',
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agy_tenant_tokens_agency_id ON agy_tenant_tokens(agency_id);
CREATE INDEX IF NOT EXISTS idx_agy_tenant_tokens_hash ON agy_tenant_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_agy_tenant_tokens_revoked ON agy_tenant_tokens(revoked_at);

CREATE TABLE IF NOT EXISTS agy_agency_domains (
  id TEXT PRIMARY KEY NOT NULL,
  agency_id TEXT NOT NULL REFERENCES agy_tenant_configs(agency_id) ON DELETE CASCADE,
  domain TEXT UNIQUE NOT NULL,
  domain_type TEXT NOT NULL DEFAULT 'custom' CHECK (domain_type IN ('subdomain', 'custom')),
  ssl_status TEXT NOT NULL DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'error')),
  verification_token TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agy_agency_domains_agency_id ON agy_agency_domains(agency_id);
CREATE INDEX IF NOT EXISTS idx_agy_agency_domains_domain ON agy_agency_domains(domain);
CREATE INDEX IF NOT EXISTS idx_agy_agency_domains_type ON agy_agency_domains(domain_type);

CREATE TABLE IF NOT EXISTS agy_audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  agency_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  resource TEXT NOT NULL,
  details_json TEXT DEFAULT '{}',
  ip_address TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agy_audit_logs_agency_id ON agy_audit_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_agy_audit_logs_timestamp ON agy_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_agy_audit_logs_event_type ON agy_audit_logs(event_type);
