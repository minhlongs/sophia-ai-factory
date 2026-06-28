-- Drop the existing check constraint
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_check;

-- Add updated check constraint with new tier values
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_subscription_tier_check
CHECK (subscription_tier IN ('free', 'basic', 'premium', 'pro', 'enterprise'));

-- Comment on column to clarify values
COMMENT ON COLUMN user_profiles.subscription_tier IS 'Subscription tier: free, basic, premium, pro (legacy), enterprise';
