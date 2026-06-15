-- Agent API key management and request logging
-- Supports external integrations calling Sophia SOP engine via authenticated API keys

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions_json TEXT NOT NULL DEFAULT '["sop:execute","sop:read"]',
  rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_key_user ON api_keys(user_id, is_active);

CREATE TABLE IF NOT EXISTS api_request_log (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  request_body_size INTEGER,
  response_body_size INTEGER,
  error_message TEXT,
  ip_address TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_log_key ON api_request_log(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_log_endpoint ON api_request_log(endpoint, created_at DESC);
