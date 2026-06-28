-- ============================================================================
-- Table: overage_events
-- Purpose: Track quota exceeded events for billing reconciliation
-- Created: 2026-03-08
-- ============================================================================

CREATE TABLE IF NOT EXISTS overage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_nonce TEXT NOT NULL REFERENCES raas_licenses(nonce) ON DELETE CASCADE,

  -- Overage details
  exceeded_type TEXT NOT NULL,  -- hourly_credits | daily_credits | monthly_credits | daily_requests
  exceeded_limit INTEGER NOT NULL,
  exceeded_current INTEGER NOT NULL,
  exceeded_by INTEGER NOT NULL,   -- How much over the limit

  -- Request context
  requested_credits INTEGER NOT NULL DEFAULT 1,
  endpoint TEXT,
  service_name TEXT,
  action TEXT,

  -- Billing context
  tier_at_exceeded TEXT NOT NULL,
  external_customer_id TEXT,      -- Stripe/Polar customer ID
  billable BOOLEAN DEFAULT false, -- Flag for billing reconciliation

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Indexes for fast queries
CREATE INDEX idx_overage_events_user ON overage_events(user_id);
CREATE INDEX idx_overage_events_license ON overage_events(license_nonce);
CREATE INDEX idx_overage_events_created_at ON overage_events(created_at DESC);
CREATE INDEX idx_overage_events_billable ON overage_events(billable) WHERE billable = true;

-- RLS
ALTER TABLE overage_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own overage events
CREATE POLICY "Users can view own overage events"
  ON overage_events FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Service role can insert
CREATE POLICY "Service role can insert overage events"
  ON overage_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'service_role'
    )
  );

-- Policy: Admins can view all
CREATE POLICY "Admins can view all overage events"
  ON overage_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

COMMENT ON TABLE overage_events IS 'Track quota exceeded events for billing reconciliation and audit';
COMMENT ON COLUMN overage_events.exceeded_type IS 'Type of quota exceeded: hourly_credits, daily_credits, monthly_credits, daily_requests';
COMMENT ON COLUMN overage_events.billable IS 'Flag for billing reconciliation - true if overage should be billed';
