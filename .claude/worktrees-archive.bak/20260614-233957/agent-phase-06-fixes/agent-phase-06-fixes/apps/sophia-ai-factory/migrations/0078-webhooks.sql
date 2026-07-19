CREATE TABLE webhook_endpoints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT NOT NULL,  -- JSON array of event names
  active INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_success_at TEXT,
  last_failure_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_webhook_tenant_active ON webhook_endpoints(tenant_id, active);

CREATE TABLE webhook_attempts (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,  -- JSON
  attempt_num INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,  -- 'pending' | 'success' | 'failed' | 'dead_letter'
  http_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  next_retry_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id)
);
CREATE INDEX idx_attempt_endpoint ON webhook_attempts(endpoint_id, created_at DESC);
CREATE INDEX idx_attempt_pending ON webhook_attempts(status, next_retry_at) WHERE status = 'failed';
