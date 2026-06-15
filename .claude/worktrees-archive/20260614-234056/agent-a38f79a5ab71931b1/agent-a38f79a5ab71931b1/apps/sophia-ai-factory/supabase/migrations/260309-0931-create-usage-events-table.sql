-- ============================================================================
-- Table: usage_events
-- Purpose: Track API usage events from Cloudflare Worker queue
-- Created: 2026-03-09
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_nonce TEXT NOT NULL REFERENCES raas_licenses(nonce) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Usage details
  tier TEXT NOT NULL,                     -- BASIC | PREMIUM | ENTERPRISE
  service TEXT NOT NULL DEFAULT 'default',
  usage_count INTEGER NOT NULL,           -- Total usage count
  overage_count INTEGER NOT NULL,         -- Requests over base limit
  overage_fee DECIMAL(10,4) NOT NULL,     -- Calculated overage fee in USD

  -- Idempotency
  idempotency_key TEXT NOT NULL UNIQUE,   -- Deduplication key
  event_timestamp TIMESTAMPTZ NOT NULL,   -- Original event timestamp
  billing_period TEXT,                    -- YYYY-MM format

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed BOOLEAN DEFAULT false,        -- Flag for billing processing
  processed_at TIMESTAMPTZ
);

-- Indexes for fast queries
CREATE INDEX idx_usage_events_user ON usage_events(user_id);
CREATE INDEX idx_usage_events_license ON usage_events(license_nonce);
CREATE INDEX idx_usage_events_idempotency ON usage_events(idempotency_key);
CREATE INDEX idx_usage_events_period ON usage_events(billing_period);
CREATE INDEX idx_usage_events_processed ON usage_events(processed) WHERE processed = false;
CREATE INDEX idx_usage_events_timestamp ON usage_events(event_timestamp DESC);

-- RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own usage events
CREATE POLICY "Users can view own usage events"
  ON usage_events FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Service role can insert
CREATE POLICY "Service role can insert usage events"
  ON usage_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'service_role'
    )
  );

-- Policy: Admins can do all operations
CREATE POLICY "Admins can manage all usage events"
  ON usage_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

COMMENT ON TABLE usage_events IS 'Track API usage events from Cloudflare Worker queue for billing';
COMMENT ON COLUMN usage_events.overage_count IS 'Number of requests over tier base limit';
COMMENT ON COLUMN usage_events.overage_fee IS 'Calculated overage fee in USD';
COMMENT ON COLUMN usage_events.idempotency_key IS 'Unique key for deduplication of queue events';
COMMENT ON COLUMN usage_events.billing_period IS 'Billing period in YYYY-MM format';
COMMENT ON COLUMN usage_events.processed IS 'Flag for billing reconciliation - true if processed';
