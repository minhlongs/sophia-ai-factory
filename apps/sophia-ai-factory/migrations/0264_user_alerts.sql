-- Migration: 0264_user_alerts
-- Platform alert dispatch table — persistent store for createRealtimeAlert.
-- Previously this table existed ONLY in PostgreSQL Supabase (Phase 7.3).
-- D1 port: gen_random_uuid -> hex(randomblob), JSONB -> TEXT (JSON),
-- TIMESTAMPTZ -> INTEGER milliseconds, RLS removed (single-tenant CF runtime).
-- All timestamps MILLISECONDS (matches reality_feedback / performance_events convention).
-- required by: createRealtimeAlert (tree/alerts/realtime-alert-mutations.ts).

CREATE TABLE IF NOT EXISTS user_alerts (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id           TEXT NOT NULL,
  license_nonce     TEXT,

  type              TEXT NOT NULL CHECK (type IN (
    'usage_threshold', 'license_expiring', 'webhook_delivery_failed',
    'quota_exceeded', 'payment_failed', 'subscription_cancelled',
    'production.run_cancelled', 'production.approval_expired', 'production.budget_cap',
    'platform.circuit_breaker', 'platform.billing_anomaly', 'platform.mission_abandon_spike'
  )),
  severity          TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  title             TEXT NOT NULL,
  message           TEXT NOT NULL,
  metadata          TEXT NOT NULL DEFAULT '{}',        -- JSON-encoded, IDs/enums only

  pushed            INTEGER NOT NULL DEFAULT 0,        -- 0/1 (D1 boolean)
  pushed_at         INTEGER,                            -- NULL until pushed

  read              INTEGER NOT NULL DEFAULT 0,
  read_at           INTEGER,
  dismissed         INTEGER NOT NULL DEFAULT 0,
  dismissed_at      INTEGER,

  ip_address        TEXT,
  endpoint          TEXT,

  created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  expires_at        INTEGER                             -- NULL = never expires
);

CREATE INDEX IF NOT EXISTS idx_user_alerts_user
  ON user_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_unread
  ON user_alerts(user_id, dismissed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_alerts_type
  ON user_alerts(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_alerts_expires
  ON user_alerts(expires_at)
  WHERE expires_at IS NOT NULL;
