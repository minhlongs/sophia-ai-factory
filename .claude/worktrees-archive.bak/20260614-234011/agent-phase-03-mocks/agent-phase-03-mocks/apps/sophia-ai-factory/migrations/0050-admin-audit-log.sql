-- Migration 0050: admin_audit_log table
-- Immutable append-only log for all admin mutations.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  actor_user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_user_id TEXT,
  payload TEXT,  -- JSON string
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON admin_audit_log(actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON admin_audit_log(action_type, created_at);
