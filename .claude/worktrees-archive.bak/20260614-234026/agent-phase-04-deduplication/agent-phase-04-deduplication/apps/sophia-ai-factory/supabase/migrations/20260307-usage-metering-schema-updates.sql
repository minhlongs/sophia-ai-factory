-- Usage Metering Schema Updates
-- Date: 2026-03-07
-- Purpose: Add idempotency, customer linkage, and resource type tracking

-- =====================================================
-- usage_events table updates
-- =====================================================

-- Add idempotency key for duplicate prevention
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Add external customer ID for billing reconciliation
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS external_customer_id TEXT;

-- Add resource type for granular tracking
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS resource_type TEXT;

-- Create unique index on idempotency key (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_idempotency_key
  ON usage_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Create index on external customer ID for billing queries
CREATE INDEX IF NOT EXISTS idx_usage_events_external_customer
  ON usage_events(external_customer_id)
  WHERE external_customer_id IS NOT NULL;

-- Create index on resource_type for analytics
CREATE INDEX IF NOT EXISTS idx_usage_events_resource_type
  ON usage_events(resource_type);

-- =====================================================
-- raas_licenses table updates
-- =====================================================

-- Add Stripe customer ID linkage
ALTER TABLE raas_licenses
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add Polar customer ID linkage
ALTER TABLE raas_licenses
  ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;

-- Add Polar subscription ID linkage
ALTER TABLE raas_licenses
  ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;

-- Add external tier mapping (JSON for flexibility)
ALTER TABLE raas_licenses
  ADD COLUMN IF NOT EXISTS external_tier_mapping JSONB DEFAULT '{}'::jsonb;

-- Create indexes for customer lookups
CREATE INDEX IF NOT EXISTS idx_raas_licenses_stripe_customer
  ON raas_licenses(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raas_licenses_polar_customer
  ON raas_licenses(polar_customer_id)
  WHERE polar_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raas_licenses_polar_subscription
  ON raas_licenses(polar_subscription_id)
  WHERE polar_subscription_id IS NOT NULL;

-- =====================================================
-- user_profiles table updates (for webhook handlers)
-- =====================================================

-- Add Polar customer ID to user_profiles for webhook lookup
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;

-- Add Stripe customer ID (if not already present from Stripe integration)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create indexes for webhook lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_polar_customer
  ON user_profiles(polar_customer_id)
  WHERE polar_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer
  ON user_profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON COLUMN usage_events.idempotency_key IS 'Unique key to prevent duplicate tracking on retries';
COMMENT ON COLUMN usage_events.external_customer_id IS 'External billing system customer ID (Stripe or Polar)';
COMMENT ON COLUMN usage_events.resource_type IS 'Type of resource consumed: model_invocation, tokens_processed, compute_time';

COMMENT ON COLUMN raas_licenses.stripe_customer_id IS 'Stripe customer ID for billing reconciliation';
COMMENT ON COLUMN raas_licenses.polar_customer_id IS 'Polar customer ID for billing reconciliation';
COMMENT ON COLUMN raas_licenses.polar_subscription_id IS 'Polar subscription ID for subscription tracking';
COMMENT ON COLUMN raas_licenses.external_tier_mapping IS 'Mapping of external tiers: {"stripe": "premium", "polar": "enterprise"}';

-- =====================================================
-- Verification queries (run after migration)
-- =====================================================

-- Verify usage_events columns
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'usage_events' AND column_name IN ('idempotency_key', 'external_customer_id', 'resource_type');

-- Verify raas_licenses columns
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'raas_licenses' AND column_name IN ('stripe_customer_id', 'polar_customer_id', 'polar_subscription_id', 'external_tier_mapping');

-- Verify indexes
-- SELECT indexname FROM pg_indexes WHERE tablename = 'usage_events' AND indexname LIKE 'idx_usage_events%';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'raas_licenses' AND indexname LIKE 'idx_raas_licenses%';
