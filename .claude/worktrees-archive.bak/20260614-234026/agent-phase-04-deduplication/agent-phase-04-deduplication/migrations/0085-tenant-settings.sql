-- Migration 0085: tenant_settings — generic namespaced JSON settings per tenant
-- Each row holds one namespace's JSON blob for a tenant. UNIQUE(tenant_id, namespace)
-- prevents duplicate entries; schema_version supports future format migrations.

CREATE TABLE IF NOT EXISTS tenant_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  namespace TEXT NOT NULL,    -- 'branding' | 'scoring' | 'geo' | 'cron' | 'channels' | 'mcp' | etc
  value TEXT NOT NULL,        -- JSON blob
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, namespace)
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);
