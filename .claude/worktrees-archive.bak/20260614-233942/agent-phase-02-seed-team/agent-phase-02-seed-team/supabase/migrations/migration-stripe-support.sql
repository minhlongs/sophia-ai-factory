-- Migration: Add Stripe webhook support to payment_events and user_profiles
-- Date: 2026-03-06
-- Description: Add stripe_event_id and stripe_subscription_id columns for Stripe integration

-- ============================================================================
-- 1. Update payment_events table
-- ============================================================================

-- Add stripe_event_id column if not exists (for idempotency)
ALTER TABLE payment_events
ADD COLUMN IF NOT EXISTS stripe_event_id TEXT UNIQUE;

-- Add polar_event_id column if not exists (for consistency)
ALTER TABLE payment_events
ADD COLUMN IF NOT EXISTS polar_event_id TEXT UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_events_stripe_event_id
ON payment_events(stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_polar_event_id
ON payment_events(polar_event_id);

-- Add index for filtering by processed status
CREATE INDEX IF NOT EXISTS idx_payment_events_processed
ON payment_events(processed);

-- ============================================================================
-- 2. Update user_profiles table
-- ============================================================================

-- Add Stripe customer ID
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add Stripe subscription ID
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id
ON user_profiles(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_subscription_id
ON user_profiles(stripe_subscription_id);

-- Add index for Polar subscription ID (for consistency)
CREATE INDEX IF NOT EXISTS idx_user_profiles_polar_subscription_id
ON user_profiles(polar_subscription_id);

-- ============================================================================
-- 3. Update raas_licenses table metadata
-- ============================================================================

-- Add comment to metadata column for documentation
COMMENT ON COLUMN raas_licenses.metadata IS
'JSON metadata containing: customerEmail, polarSubscriptionId, stripeSubscriptionId,
stripeCustomerId, source (auto-generated), generatedAt, and other tracking data';

-- ============================================================================
-- 4. Create view for payment event audit
-- ============================================================================

CREATE OR REPLACE VIEW payment_events_audit AS
SELECT
  id,
  event_type,
  stripe_event_id,
  polar_event_id,
  processed,
  created_at,
  CASE
    WHEN stripe_event_id IS NOT NULL THEN 'stripe'
    WHEN polar_event_id IS NOT NULL THEN 'polar'
    ELSE 'unknown'
  END as provider,
  CASE
    WHEN processed THEN 'processed'
    ELSE 'pending'
  END as status
FROM payment_events
ORDER BY created_at DESC;

-- ============================================================================
-- 5. Create view for subscription linkage
-- ============================================================================

CREATE OR REPLACE VIEW subscription_license_linkage AS
SELECT
  up.user_id,
  up.subscription_tier,
  up.subscription_status,
  up.polar_subscription_id,
  up.stripe_subscription_id,
  rl.nonce as license_nonce,
  rl.tier as license_tier,
  rl.is_revoked,
  rl.expires_at,
  CASE
    WHEN up.polar_subscription_id IS NOT NULL THEN 'polar'
    WHEN up.stripe_subscription_id IS NOT NULL THEN 'stripe'
    ELSE 'none'
  END as payment_provider
FROM user_profiles up
LEFT JOIN raas_licenses rl ON
  rl.metadata->>'polarSubscriptionId' = up.polar_subscription_id OR
  rl.metadata->>'stripeSubscriptionId' = up.stripe_subscription_id
ORDER BY up.created_at DESC;

-- ============================================================================
-- Migration Notes
-- ============================================================================

-- This migration is idempotent - safe to run multiple times
-- Run with: psql -f migration-stripe-support.sql

-- To verify migration:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'payment_events' AND column_name IN ('stripe_event_id', 'polar_event_id');

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'user_profiles' AND column_name LIKE '%stripe%';
