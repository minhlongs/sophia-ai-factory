-- Wave 21 Phase 02 — Account self-delete with 7-day cooldown
-- Tracks pending account deletion requests with double-confirm flow:
--   1. POST /api/account/delete/request → row inserted, email sent
--   2. GET  /api/account/delete/confirm  → confirmed_at set, scheduled_at = now + 7d
--   3. After 7d cooldown, DELETE /api/account succeeds (or admin/cron triggers cascade)
--   Cancel anytime via POST /api/account/delete/request {action: 'cancel'}

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  user_id            TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  requested_at       INTEGER NOT NULL,
  scheduled_at       INTEGER NOT NULL,
  confirmation_token TEXT NOT NULL,
  confirmed_at       INTEGER,
  cancelled_at       INTEGER,
  created_at         INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_acct_del_scheduled
  ON account_deletion_requests(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_acct_del_pending
  ON account_deletion_requests(confirmed_at, cancelled_at);
