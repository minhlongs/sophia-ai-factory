-- Migration 0288: Enterprise Multi-Org SAML/OIDC SSO & Cryptographic Hash-Chain Audit Vault
-- Milestone 2 — Enterprise Scale Engine (SOC 2 CC7.2 Compliance & Multi-Org Governance)

-- 1. Enterprise SSO Configurations (SAML 2.0 & OIDC)
CREATE TABLE IF NOT EXISTS enterprise_sso_configs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('saml', 'oidc')),
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT,
  metadata_url TEXT,
  sso_url TEXT,
  certificate TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_esso_domain ON enterprise_sso_configs(domain);
CREATE INDEX IF NOT EXISTS idx_esso_org_id ON enterprise_sso_configs(org_id);
CREATE INDEX IF NOT EXISTS idx_esso_enabled ON enterprise_sso_configs(enabled);

-- 2. Immutable Cryptographic Hash-Chain Audit Vault
CREATE TABLE IF NOT EXISTS enterprise_audit_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  prev_hash TEXT,
  content_hash TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Exact indexes mandated by specification
CREATE INDEX IF NOT EXISTS idx_eae_org_ts ON enterprise_audit_events(org_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_eae_action ON enterprise_audit_events(action);
CREATE INDEX IF NOT EXISTS idx_eae_actor ON enterprise_audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_eae_content_hash ON enterprise_audit_events(content_hash);
CREATE INDEX IF NOT EXISTS idx_eae_prev_hash ON enterprise_audit_events(prev_hash);
