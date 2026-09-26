-- Migration 0295: Enterprise CRM Bi-directional Sync & Webhook Bus
-- Milestone: Q3 2027 ($400,000 MRR / 2,000 Paid Customers) — Pillar R2
-- Target: Cloudflare D1 (sophia-raas-db)

PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;

-- 1. Table: enterprise_crm_configs
CREATE TABLE IF NOT EXISTS enterprise_crm_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('salesforce', 'hubspot', 'zapier', 'custom')),
  api_endpoint TEXT,
  client_id TEXT,
  client_secret_encrypted TEXT,
  refresh_token_encrypted TEXT,
  access_token_encrypted TEXT,
  token_expires_at INTEGER,
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK(sync_direction IN ('inbound', 'outbound', 'bidirectional')),
  is_active INTEGER NOT NULL DEFAULT 1,
  field_mapping_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_crm_configs_tenant ON enterprise_crm_configs(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_crm_configs_provider ON enterprise_crm_configs(provider);

-- 2. Table: crm_sync_events
CREATE TABLE IF NOT EXISTS crm_sync_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  crm_config_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('deal', 'opportunity', 'contact', 'lead', 'invoice')),
  entity_id TEXT NOT NULL,
  external_id TEXT,
  direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'synced', 'failed', 'ignored')),
  payload_json TEXT NOT NULL,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER,
  synced_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (crm_config_id) REFERENCES enterprise_crm_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_sync_status ON crm_sync_events(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_crm_sync_entity ON crm_sync_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_tenant ON crm_sync_events(tenant_id, created_at DESC);

-- 3. Table: webhook_subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  event_types TEXT NOT NULL, -- JSON array of strings e.g. ["deal.won", "video.rendered"]
  is_active INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_delivery_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_tenant ON webhook_subscriptions(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_active ON webhook_subscriptions(is_active);

-- 4. Table: webhook_delivery_logs
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  signature TEXT NOT NULL,
  http_status INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'retrying')),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_sub ON webhook_delivery_logs(subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON webhook_delivery_logs(event_type);
