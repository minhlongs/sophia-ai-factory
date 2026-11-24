-- Controlled Future Brand Domain Registry & Immutable Audit Trail
-- Decouples brand hostnames from Worker code deployment so approved domains
-- can be registered, verified against 10 security/TLS/auth gates, activated,
-- suspended, or rolled back without rebuilding the application.

CREATE TABLE IF NOT EXISTS brand_domains (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL UNIQUE,
  cloudflare_zone_id TEXT,
  worker_name TEXT NOT NULL,
  tenant_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'VERIFIED', 'ACTIVE', 'SUSPENDED')),
  is_canonical INTEGER NOT NULL DEFAULT 0,
  auth_policy TEXT NOT NULL DEFAULT 'standard',
  ownership_verified INTEGER NOT NULL DEFAULT 0,
  cf_zone_eligible INTEGER NOT NULL DEFAULT 0,
  worker_attached INTEGER NOT NULL DEFAULT 0,
  tls_verified INTEGER NOT NULL DEFAULT 0,
  auth_origin_verified INTEGER NOT NULL DEFAULT 0,
  access_policy_verified INTEGER NOT NULL DEFAULT 0,
  tenant_auth_verified INTEGER NOT NULL DEFAULT 0,
  no_public_bypass_verified INTEGER NOT NULL DEFAULT 0,
  external_callbacks_reviewed INTEGER NOT NULL DEFAULT 0,
  smoke_verified INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  activated_by TEXT,
  activated_at TEXT,
  suspended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_brand_domains_status_worker
  ON brand_domains (status, worker_name);

CREATE INDEX IF NOT EXISTS idx_brand_domains_tenant
  ON brand_domains (tenant_id);

CREATE TABLE IF NOT EXISTS brand_domain_audit_events (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  hostname TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('REGISTERED', 'CHECKS_UPDATED', 'VERIFIED', 'ACTIVATED', 'SUSPENDED', 'ROLLED_BACK')),
  actor_id TEXT NOT NULL,
  actor_email TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (domain_id) REFERENCES brand_domains (id)
);

CREATE INDEX IF NOT EXISTS idx_brand_domain_audit_domain_time
  ON brand_domain_audit_events (domain_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_domain_audit_created
  ON brand_domain_audit_events (created_at DESC);
