-- Migration 0489: Postback Dead-Letter Queue
-- Captures unmapped, unverifiable, or failed legacy/canonical postbacks for durable audit, inspection, and replay.

CREATE TABLE IF NOT EXISTS postback_dead_letter (
  id TEXT PRIMARY KEY,
  network TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  source_ip TEXT,
  headers_json TEXT NOT NULL DEFAULT '{}',
  payload TEXT NOT NULL DEFAULT '',
  failure_reason TEXT NOT NULL,
  tenant_hint TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_postback_dlq_network
  ON postback_dead_letter(network, resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_postback_dlq_tenant
  ON postback_dead_letter(tenant_hint, resolved, created_at DESC);
