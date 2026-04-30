-- Migration: audit_hooks
-- Phase 12 — OpenClaw Orchestrator
-- Audit log (immutable insert-only) + hooks registry

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT,
  metadata_json TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_ts ON audit_log(tenant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_ts ON audit_log(action, ts DESC);

CREATE TABLE IF NOT EXISTS hooks_registry (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event TEXT NOT NULL,
  handler_module TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(tenant_id, event, handler_module)
);

CREATE INDEX IF NOT EXISTS idx_hooks_tenant_event ON hooks_registry(tenant_id, event, enabled);

-- Memory KV fallback when claude-mem MCP unavailable
CREATE TABLE IF NOT EXISTS memory_kv (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  key_name TEXT NOT NULL,
  value_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(tenant_id, type, key_name)
);

CREATE INDEX IF NOT EXISTS idx_memory_kv_tenant_type ON memory_kv(tenant_id, type, key_name);
