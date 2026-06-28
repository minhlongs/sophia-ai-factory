-- ============================================================================
-- Update: overage_events
-- Purpose: Add columns for Cloudflare Worker overage billing integration
-- Created: 2026-03-09
-- ============================================================================

-- Add new columns for overage billing integration
ALTER TABLE overage_events
  ADD COLUMN IF NOT EXISTS overage_count INTEGER,
  ADD COLUMN IF NOT EXISTS overage_fee DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS billing_period TEXT,
  ADD COLUMN IF NOT EXISTS service_name TEXT,
  ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Add unique index on idempotency_key for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_overage_events_idempotency
  ON overage_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Update comments
COMMENT ON COLUMN overage_events.overage_count IS 'Number of requests over tier base limit';
COMMENT ON COLUMN overage_events.overage_fee IS 'Calculated overage fee in USD';
COMMENT ON COLUMN overage_events.idempotency_key IS 'Unique key for deduplication';
COMMENT ON COLUMN overage_events.billing_period IS 'Billing period in YYYY-MM format';
COMMENT ON COLUMN overage_events.processed IS 'Flag for billing reconciliation';
