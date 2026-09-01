-- Migration: 0265_user_alerts_extend
-- Extend user_alerts.type CHECK constraint with Phase 2B production alert types.
-- Adds: platform.distribution_pipeline, platform.creative_quality_drift, platform.agent_cost_overrun

-- SQLite does not support ALTER TABLE ... ALTER COLUMN ... DROP/ADD CHECK
-- Must rebuild table via CREATE TABLE AS / RENAME sequence.

BEGIN TRANSACTION;

-- 1. Create new table with extended CHECK constraint
CREATE TABLE user_alerts_new (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id           TEXT NOT NULL,
  license_nonce     TEXT,

  type              TEXT NOT NULL CHECK (type IN (
    'usage_threshold', 'license_expiring', 'webhook_delivery_failed',
    'quota_exceeded', 'payment_failed', 'subscription_cancelled',
    'production.run_cancelled', 'production.approval_expired', 'production.budget_cap',
    'platform.circuit_breaker', 'platform.billing_anomaly', 'platform.mission_abandon_spike',
    'platform.distribution_pipeline', 'platform.creative_quality_drift', 'platform.agent_cost_overrun'
  )),
  severity          TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  title             TEXT NOT NULL,
  message           TEXT NOT NULL,
  metadata          TEXT NOT NULL DEFAULT '{}',

  pushed            INTEGER NOT NULL DEFAULT 0,
  pushed_at         INTEGER,

  read              INTEGER NOT NULL DEFAULT 0,
  read_at           INTEGER,
  dismissed         INTEGER NOT NULL DEFAULT 0,
  dismissed_at      INTEGER,

  ip_address        TEXT,
  endpoint          TEXT,

  created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  expires_at        INTEGER
);

-- 2. Copy data
INSERT INTO user_alerts_new (
  id, user_id, license_nonce, type, severity, title, message, metadata,
  pushed, pushed_at, read, read_at, dismissed, dismissed_at,
  ip_address, endpoint, created_at, expires_at
)
SELECT
  id, user_id, license_nonce, type, severity, title, message, metadata,
  pushed, pushed_at, read, read_at, dismissed, dismissed_at,
  ip_address, endpoint, created_at, expires_at
FROM user_alerts;

-- 3. Drop old table
DROP TABLE user_alerts;

-- 4. Rename new table
ALTER TABLE user_alerts_new RENAME TO user_alerts;

-- 5. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_user_alerts_user
  ON user_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_unread
  ON user_alerts(user_id, dismissed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_alerts_type
  ON user_alerts(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_alerts_expires
  ON user_alerts(expires_at)
  WHERE expires_at IS NOT NULL;

COMMIT;