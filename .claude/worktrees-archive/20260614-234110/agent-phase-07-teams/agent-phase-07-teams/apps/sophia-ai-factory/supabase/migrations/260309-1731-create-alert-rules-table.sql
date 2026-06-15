-- ============================================================================
-- Table: alert_rules
-- Purpose: User-configurable alert rules for custom thresholds and channels
-- Created: 2026-03-09
-- Phase: 7 - Real-time Usage Alerting & Threshold Enforcement
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_nonce TEXT NOT NULL REFERENCES raas_licenses(nonce) ON DELETE CASCADE,

  -- Rule configuration
  threshold_percent INTEGER NOT NULL CHECK (threshold_percent >= 0 AND threshold_percent <= 100),
  enabled BOOLEAN DEFAULT true,
  channels TEXT[] DEFAULT ARRAY['email']::TEXT[], -- ['email', 'sms', 'webhook']

  -- Webhook configuration
  webhook_url TEXT,
  webhook_secret TEXT, -- For HMAC signature verification

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for fast queries
CREATE INDEX idx_alert_rules_user ON alert_rules(user_id);
CREATE INDEX idx_alert_rules_license ON alert_rules(license_nonce);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled) WHERE enabled = true;
CREATE INDEX idx_alert_rules_threshold ON alert_rules(threshold_percent);

-- Unique constraint: One rule per user, license, and threshold
CREATE UNIQUE CONSTRAINT idx_alert_rules_unique
  ON alert_rules(user_id, license_nonce, threshold_percent);

-- RLS
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own alert rules
CREATE POLICY "Users can manage own alert rules"
  ON alert_rules FOR ALL
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Admins can manage all alert rules
CREATE POLICY "Admins can manage all alert rules"
  ON alert_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

COMMENT ON TABLE alert_rules IS 'User-configurable alert rules for custom thresholds and channels (Phase 7)';
COMMENT ON COLUMN alert_rules.threshold_percent IS 'Custom threshold percentage (0-100) to trigger alert';
COMMENT ON COLUMN alert_rules.channels IS 'Array of enabled channels: email, sms, webhook';
COMMENT ON COLUMN alert_rules.webhook_url IS 'Custom webhook URL for webhook channel delivery';
COMMENT ON COLUMN alert_rules.webhook_secret IS 'Secret key for HMAC signature generation (optional)';
