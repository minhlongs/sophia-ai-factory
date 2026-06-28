-- Add subscription expiration tracking for monthly maintenance billing
-- Migration: 007_add_subscription_expiration.sql

-- Add expiration column for subscription checking
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;

-- Update tier constraint to include 'basic' 
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_check;

ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'basic', 'pro', 'premium', 'enterprise'));

-- Index for querying expired subscriptions (for cron cleanup)
CREATE INDEX IF NOT EXISTS idx_user_profiles_expires 
ON user_profiles(subscription_expires_at) 
WHERE subscription_expires_at IS NOT NULL;

-- Function to auto-downgrade expired subscriptions (optional cron)
CREATE OR REPLACE FUNCTION downgrade_expired_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET 
    subscription_tier = 'basic',
    subscription_status = 'expired',
    updated_at = NOW()
  WHERE 
    subscription_expires_at IS NOT NULL 
    AND subscription_expires_at < NOW()
    AND subscription_tier != 'basic';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN user_profiles.subscription_expires_at IS 'When subscription expires. NULL = lifetime/one-time purchase';
COMMENT ON COLUMN user_profiles.polar_customer_id IS 'Polar customer ID for subscription portal access';
