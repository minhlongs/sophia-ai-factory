-- ============================================================================
-- Tables: dunning_attempts, dunning_settings, billing_events
-- Purpose: Complete dunning workflow schema for overage billing
-- Created: 2026-03-09
-- Related: 260308-1800-create-overage-events-table.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: dunning_settings
-- Purpose: Store dunning configuration per user/license
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dunning_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_nonce TEXT NOT NULL UNIQUE REFERENCES raas_licenses(nonce) ON DELETE CASCADE,
  polar_customer_id TEXT,
  stripe_customer_id TEXT,

  -- Dunning configuration
  grace_period_days INTEGER DEFAULT 3,          -- Days before suspension
  max_retry_attempts INTEGER DEFAULT 4,         -- Max payment retries
  retry_schedule INTERVAL[] DEFAULT ARRAY[
    '1 day'::INTERVAL,
    '3 days'::INTERVAL,
    '7 days'::INTERVAL,
    '15 days'::INTERVAL
  ],

  -- Email settings
  send_email_notifications BOOLEAN DEFAULT true,
  email_language TEXT DEFAULT 'en',

  -- Current dunning state
  dunning_state TEXT DEFAULT 'current',         -- current | past_due | delinquent | suspended
  dunning_state_changed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dunning_settings_user ON dunning_settings(user_id);
CREATE INDEX idx_dunning_settings_license ON dunning_settings(license_nonce);
CREATE INDEX idx_dunning_settings_state ON dunning_settings(dunning_state);

-- RLS
ALTER TABLE dunning_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own settings
CREATE POLICY "Users can view own dunning settings"
  ON dunning_settings FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Admins have full access
CREATE POLICY "Admins have full access to dunning settings"
  ON dunning_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Service role can insert/update
CREATE POLICY "Service role can manage dunning settings"
  ON dunning_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'service_role'
    )
  );

COMMENT ON TABLE dunning_settings IS 'Dunning workflow configuration per license';
COMMENT ON COLUMN dunning_settings.dunning_state IS 'Current state: current, past_due, delinquent, suspended';
COMMENT ON COLUMN dunning_settings.grace_period_days IS 'Days in past_due state before suspension';
COMMENT ON COLUMN dunning_settings.retry_schedule IS 'Array of intervals for payment retry attempts';

-- ----------------------------------------------------------------------------
-- Table: dunning_attempts
-- Purpose: Track payment retry history and dunning state transitions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dunning_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_nonce TEXT NOT NULL REFERENCES raas_licenses(nonce) ON DELETE CASCADE,

  -- Payment attempt details
  attempt_number INTEGER NOT NULL DEFAULT 1,
  attempt_type TEXT NOT NULL,                 -- invoice_payment | retry | manual
  payment_provider TEXT NOT NULL,             -- stripe | polar

  -- Attempt result
  success BOOLEAN DEFAULT false,
  amount DECIMAL(10,2),                       -- Amount attempted to charge
  currency TEXT DEFAULT 'USD',
  failure_reason TEXT,                        -- Card declined, insufficient funds, etc.
  provider_response_id TEXT,                  -- Stripe charge ID / Polar order ID

  -- Dunning state at time of attempt
  dunning_state_before TEXT,
  dunning_state_after TEXT,

  -- Next retry scheduling
  next_retry_at TIMESTAMPTZ,
  scheduled_retry_count INTEGER DEFAULT 0,

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key to related invoice/charge
  stripe_invoice_id TEXT,
  polar_order_id TEXT
);

-- Indexes for fast queries
CREATE INDEX idx_dunning_attempts_user ON dunning_attempts(user_id);
CREATE INDEX idx_dunning_attempts_license ON dunning_attempts(license_nonce);
CREATE INDEX idx_dunning_attempts_next_retry ON dunning_attempts(next_retry_at) WHERE success = false;
CREATE INDEX idx_dunning_attempts_created_at ON dunning_attempts(created_at DESC);

-- RLS
ALTER TABLE dunning_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own attempts
CREATE POLICY "Users can view own dunning attempts"
  ON dunning_attempts FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Service role can insert
CREATE POLICY "Service role can insert dunning attempts"
  ON dunning_attempts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'service_role'
    )
  );

-- Policy: Admins can view all
CREATE POLICY "Admins can view all dunning attempts"
  ON dunning_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

COMMENT ON TABLE dunning_attempts IS 'Track payment retry attempts and dunning state transitions';
COMMENT ON COLUMN dunning_attempts.attempt_type IS 'Type of attempt: invoice_payment, retry, manual';
COMMENT ON COLUMN dunning_attempts.dunning_state_before IS 'Dunning state before this attempt';
COMMENT ON COLUMN dunning_attempts.dunning_state_after IS 'Dunning state after this attempt';
COMMENT ON COLUMN dunning_attempts.next_retry_at IS 'Scheduled time for next retry (if failed)';

-- ----------------------------------------------------------------------------
-- Table: billing_events
-- Purpose: Comprehensive audit log for all billing-related events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_nonce TEXT NOT NULL REFERENCES raas_licenses(nonce) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL,                   -- overage_detected, invoice_created, payment_failed, etc.
  event_category TEXT NOT NULL,               -- overage, invoice, payment, dunning, refund

  -- Event data
  event_data JSONB NOT NULL DEFAULT '{}',     -- Flexible event payload
  amount DECIMAL(10,2),                       -- Associated amount
  currency TEXT DEFAULT 'USD',

  -- Provider references
  payment_provider TEXT,                      -- stripe | polar
  provider_event_id TEXT,                     -- Stripe event ID / Polar event ID
  provider_invoice_id TEXT,
  provider_charge_id TEXT,

  -- Email notifications
  email_sent BOOLEAN DEFAULT false,
  email_template TEXT,
  email_recipient TEXT,
  email_sent_at TIMESTAMPTZ,

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ
);

-- Indexes for fast queries
CREATE INDEX idx_billing_events_user ON billing_events(user_id);
CREATE INDEX idx_billing_events_license ON billing_events(license_nonce);
CREATE INDEX idx_billing_events_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_category ON billing_events(event_category);
CREATE INDEX idx_billing_events_created_at ON billing_events(created_at DESC);
CREATE INDEX idx_billing_events_email_pending ON billing_events(email_sent) WHERE email_sent = false;
CREATE INDEX idx_billing_events_data ON billing_events USING GIN (event_data);

-- RLS
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own events
CREATE POLICY "Users can view own billing events"
  ON billing_events FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Service role can insert
CREATE POLICY "Service role can insert billing events"
  ON billing_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'service_role'
    )
  );

-- Policy: Admins can view all
CREATE POLICY "Admins can view all billing events"
  ON billing_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

COMMENT ON TABLE billing_events IS 'Comprehensive audit log for all billing-related events';
COMMENT ON COLUMN billing_events.event_type IS 'Specific event: overage_detected, invoice_created, payment_failed, payment_succeeded, dunning_state_changed, refund_processed';
COMMENT ON COLUMN billing_events.event_category IS 'Category: overage, invoice, payment, dunning, refund';
COMMENT ON COLUMN billing_events.event_data IS 'Flexible JSON payload with event-specific data';
COMMENT ON COLUMN billing_events.email_sent IS 'Whether notification email was sent for this event';

-- ----------------------------------------------------------------------------
-- Helper Functions
-- ----------------------------------------------------------------------------

-- Function: Update dunning state based on payment failure
CREATE OR REPLACE FUNCTION update_dunning_state(
  p_license_nonce TEXT,
  p_new_state TEXT,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_setting_id UUID;
BEGIN
  -- Insert or update dunning settings
  INSERT INTO dunning_settings (user_id, license_nonce, dunning_state, dunning_state_changed_at, updated_at)
  VALUES (p_user_id, p_license_nonce, p_new_state, NOW(), NOW())
  ON CONFLICT (license_nonce) DO UPDATE SET
    dunning_state = EXCLUDED.dunning_state,
    dunning_state_changed_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_setting_id;

  -- Log the state change
  INSERT INTO billing_events (user_id, license_nonce, event_type, event_category, event_data)
  VALUES (
    p_user_id,
    p_license_nonce,
    'dunning_state_changed',
    'dunning',
    jsonb_build_object(
      'old_state', (SELECT dunning_state FROM dunning_settings WHERE license_nonce = p_license_nonce),
      'new_state', p_new_state
    )
  );

  RETURN v_setting_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_dunning_state IS 'Update dunning state and log state change event';

-- Function: Get dunning state for license
CREATE OR REPLACE FUNCTION get_dunning_state(p_license_nonce TEXT)
RETURNS TABLE (
  dunning_state TEXT,
  grace_period_ends_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  failed_payment_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.dunning_state::TEXT,
    CASE
      WHEN ds.dunning_state = 'past_due'
      THEN ds.dunning_state_changed_at + (ds.grace_period_days || ' days')::INTERVAL
      ELSE NULL
    END AS grace_period_ends_at,
    (SELECT MAX(da.next_retry_at) FROM dunning_attempts da WHERE da.license_nonce = p_license_nonce AND da.success = false) AS next_retry_at,
    (SELECT COUNT(*) FROM dunning_attempts da WHERE da.license_nonce = p_license_nonce AND da.success = false AND da.created_at > NOW() - INTERVAL '30 days') AS failed_payment_count
  FROM dunning_settings ds
  WHERE ds.license_nonce = p_license_nonce;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_dunning_state IS 'Get current dunning state with grace period and retry info';

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------

-- Trigger: Auto-update updated_at on dunning_settings
CREATE OR REPLACE FUNCTION update_dunning_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dunning_settings_timestamp
  BEFORE UPDATE ON dunning_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_dunning_settings_timestamp();

COMMENT ON TRIGGER trigger_update_dunning_settings_timestamp ON dunning_settings IS 'Auto-update updated_at timestamp';

-- ----------------------------------------------------------------------------
-- Initial Data: Create dunning settings for existing licenses
-- ----------------------------------------------------------------------------
-- This will be run by a migration script, not in the migration itself
-- to avoid locking issues on large tables

-- INSERT INTO dunning_settings (user_id, license_nonce, polar_customer_id, stripe_customer_id)
-- SELECT
--   rl.created_by,
--   rl.nonce,
--   rl.polar_customer_id,
--   rl.stripe_customer_id
-- FROM raas_licenses rl
-- LEFT JOIN dunning_settings ds ON rl.nonce = ds.license_nonce
-- WHERE ds.id IS NULL;
