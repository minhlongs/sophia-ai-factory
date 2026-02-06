-- Add Lemon Squeezy columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id text,
ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id text,
ADD COLUMN IF NOT EXISTS lemonsqueezy_order_id text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_lemonsqueezy_customer_id ON user_profiles(lemonsqueezy_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_lemonsqueezy_subscription_id ON user_profiles(lemonsqueezy_subscription_id);

-- Comment on columns
COMMENT ON COLUMN user_profiles.lemonsqueezy_customer_id IS 'Lemon Squeezy Customer ID for the user';
COMMENT ON COLUMN user_profiles.lemonsqueezy_subscription_id IS 'Lemon Squeezy Subscription ID if active';
