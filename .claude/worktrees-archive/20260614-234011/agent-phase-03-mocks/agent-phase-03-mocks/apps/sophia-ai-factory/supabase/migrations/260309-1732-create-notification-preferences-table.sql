-- ============================================================================
-- Table: notification_preferences
-- Purpose: User notification preferences for alert channels and language
-- Created: 2026-03-09
-- Phase: 7 - Real-time Usage Alerting & Threshold Enforcement
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Channel preferences
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  webhook_enabled BOOLEAN DEFAULT false,

  -- Default webhook URL (used if no rule-specific URL)
  default_webhook_url TEXT,
  default_webhook_secret TEXT,

  -- Language preference
  language VARCHAR DEFAULT 'en' CHECK (language IN ('en', 'vi')),

  -- Metadata
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Index for fast lookups
CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own preferences
CREATE POLICY "Users can manage own notification preferences"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid());

-- Policy: Admins can manage all preferences
CREATE POLICY "Admins can manage all notification preferences"
  ON notification_preferences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

COMMENT ON TABLE notification_preferences IS 'User notification preferences for alert channels and language (Phase 7)';
COMMENT ON COLUMN notification_preferences.email_enabled IS 'Enable email notifications';
COMMENT ON COLUMN notification_preferences.sms_enabled IS 'Enable SMS notifications';
COMMENT ON COLUMN notification_preferences.webhook_enabled IS 'Enable webhook notifications';
COMMENT ON COLUMN notification_preferences.default_webhook_url IS 'Default webhook URL for alert delivery';
COMMENT ON COLUMN notification_preferences.default_webhook_secret IS 'Default webhook secret for HMAC signatures';
COMMENT ON COLUMN notification_preferences.language IS 'Preferred language: en (English) or vi (Vietnamese)';
