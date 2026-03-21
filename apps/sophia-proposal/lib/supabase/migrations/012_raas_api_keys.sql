-- Migration 012: RaaS API Keys, Usage Tracking, Webhook Deliveries
-- Supports external RaaS consumers with API key auth

-- API keys for external RaaS consumers
CREATE TABLE IF NOT EXISTS raas_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the actual key
  key_prefix TEXT NOT NULL,      -- first 16 chars for display: sk_live_xxxxxxxx
  permissions JSONB DEFAULT '["missions:create","missions:read"]'::jsonb,
  rate_limit_per_minute INT DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_raas_keys_org ON raas_api_keys(org_id);
CREATE INDEX idx_raas_keys_hash ON raas_api_keys(key_hash);

-- API usage tracking per key
CREATE TABLE IF NOT EXISTS raas_api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES raas_api_keys(id),
  org_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT,
  mcu_consumed INT DEFAULT 0,
  response_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_raas_usage_key ON raas_api_usage(api_key_id);
CREATE INDEX idx_raas_usage_org_date ON raas_api_usage(org_id, created_at);

-- Webhook deliveries for mission completion events
CREATE TABLE IF NOT EXISTS raas_webhook_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES missions(id),
  org_id UUID NOT NULL,
  webhook_url TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INT,
  attempt_number INT DEFAULT 1,
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_mission ON raas_webhook_deliveries(mission_id);
