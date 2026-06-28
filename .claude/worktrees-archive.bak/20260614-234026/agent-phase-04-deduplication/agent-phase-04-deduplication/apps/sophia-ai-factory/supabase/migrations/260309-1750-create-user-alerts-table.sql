-- ============================================================================
-- Table: user_alerts
-- Purpose: Real-time alerts for WebSocket push to AgencyOS dashboard
-- Created: 2026-03-09
-- Phase: 7.3 - Real-time Alert Integration (WebSocket-based)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_nonce TEXT REFERENCES raas_licenses(nonce) ON DELETE CASCADE,

  -- Alert type and severity
  type VARCHAR NOT NULL CHECK (type IN (
    'usage_threshold',
    'license_expiring',
    'webhook_delivery_failed',
    'quota_exceeded',
    'payment_failed',
    'subscription_cancelled'
  )),
  severity VARCHAR NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Alert content
  title VARCHAR NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,

  -- Delivery status
  pushed BOOLEAN DEFAULT false,
  pushed_at TIMESTAMPTZ,

  -- Read status (for dashboard)
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,

  -- Request context
  ip_address TEXT,
  endpoint TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Alert expires after this time (auto-cleanup)
);

-- Indexes for fast queries
CREATE INDEX idx_user_alerts_user ON user_alerts(user_id);
CREATE INDEX idx_user_alerts_license ON user_alerts(license_nonce);
CREATE INDEX idx_user_alerts_type ON user_alerts(type);
CREATE INDEX idx_user_alerts_severity ON user_alerts(severity);
CREATE INDEX idx_user_alerts_read ON user_alerts(read) WHERE read = false;
CREATE INDEX idx_user_alerts_created ON user_alerts(created_at DESC);
CREATE INDEX idx_user_alerts_unread_user ON user_alerts(user_id, read) WHERE read = false;

-- RLS
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own alerts
CREATE POLICY "Users can view own user_alerts"
  ON user_alerts FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can update their own alerts (mark as read/dismissed)
CREATE POLICY "Users can update own user_alerts"
  ON user_alerts FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: Service role can insert
CREATE POLICY "Service role can insert user_alerts"
  ON user_alerts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'service_role'
    )
  );

-- Policy: Admins can manage all alerts
CREATE POLICY "Admins can manage all user_alerts"
  ON user_alerts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

COMMENT ON TABLE user_alerts IS 'Real-time alerts for WebSocket push to AgencyOS dashboard (Phase 7.3)';
COMMENT ON COLUMN user_alerts.type IS 'Alert type: usage_threshold, license_expiring, webhook_delivery_failed, etc.';
COMMENT ON COLUMN user_alerts.metadata IS 'Additional alert data (JSONB) for dashboard display';
COMMENT ON COLUMN user_alerts.pushed IS 'True if alert was pushed via WebSocket';
COMMENT ON COLUMN user_alerts.read IS 'True if user has read the alert in dashboard';
COMMENT ON COLUMN user_alerts.dismissed IS 'True if user has dismissed the alert';
COMMENT ON COLUMN user_alerts.expires_at IS 'Alert expiration time for auto-cleanup';
