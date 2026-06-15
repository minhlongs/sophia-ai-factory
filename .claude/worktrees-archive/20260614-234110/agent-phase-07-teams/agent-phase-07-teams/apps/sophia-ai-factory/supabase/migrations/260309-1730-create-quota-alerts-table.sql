-- ============================================================================
-- Table: quota_alerts
-- Purpose: Track quota alert delivery history for audit and analytics
-- Created: 2026-03-09
-- Phase: 7 - Real-time Usage Alerting & Threshold Enforcement
-- ============================================================================

CREATE TABLE IF NOT EXISTS quota_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_nonce TEXT NOT NULL REFERENCES raas_licenses(nonce) ON DELETE CASCADE,

  -- Alert details
  threshold INTEGER NOT NULL CHECK (threshold IN (80, 90, 100)),
  channel VARCHAR NOT NULL CHECK (channel IN ('email', 'sms', 'webhook')),
  recipient VARCHAR NOT NULL, -- Email, phone, or webhook URL

  -- Template content
  template_subject VARCHAR,
  template_body TEXT,

  -- Delivery status
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  delivery_error TEXT,

  -- Request context
  ip_address TEXT,
  user_agent TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_quota_alerts_user ON quota_alerts(user_id);
CREATE INDEX idx_quota_alerts_license ON quota_alerts(license_nonce);
CREATE INDEX idx_quota_alerts_threshold ON quota_alerts(threshold);
CREATE INDEX idx_quota_alerts_channel ON quota_alerts(channel);
CREATE INDEX idx_quota_alerts_sent ON quota_alerts(sent) WHERE sent = true;
CREATE INDEX idx_quota_alerts_timestamp ON quota_alerts(created_at DESC);

-- Composite index for rate limiting queries
CREATE INDEX idx_quota_alerts_user_threshold_time
  ON quota_alerts(user_id, threshold, created_at DESC);

-- RLS
ALTER TABLE quota_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own alerts
CREATE POLICY "Users can view own quota alerts"
  ON quota_alerts FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Service role can insert
CREATE POLICY "Service role can insert quota alerts"
  ON quota_alerts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'service_role'
    )
  );

-- Policy: Admins can manage all alerts
CREATE POLICY "Admins can manage all quota alerts"
  ON quota_alerts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

COMMENT ON TABLE quota_alerts IS 'Track quota alert delivery history for audit and analytics (Phase 7)';
COMMENT ON COLUMN quota_alerts.threshold IS 'Alert threshold percentage: 80, 90, or 100';
COMMENT ON COLUMN quota_alerts.channel IS 'Delivery channel: email, sms, or webhook';
COMMENT ON COLUMN quota_alerts.recipient IS 'Email address, phone number, or webhook URL';
COMMENT ON COLUMN quota_alerts.template_subject IS 'Email subject line for the alert';
COMMENT ON COLUMN quota_alerts.template_body IS 'Full alert message content';
COMMENT ON COLUMN quota_alerts.delivery_error IS 'Error message if delivery failed';
