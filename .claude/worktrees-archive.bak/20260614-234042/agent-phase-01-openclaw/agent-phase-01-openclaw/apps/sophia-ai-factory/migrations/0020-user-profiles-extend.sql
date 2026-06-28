-- Migration 0020: Extend user_profiles with subscription_tier and telegram_chat_id
-- Fixes: C1 — missing columns used by all Telegram command handlers
-- subscription_tier UPPERCASE per project rule (BASIC|PREMIUM|ENTERPRISE|MASTER)
-- telegram_chat_id links Telegram chat to user account

ALTER TABLE user_profiles ADD COLUMN subscription_tier TEXT DEFAULT 'BASIC'
  CHECK (subscription_tier IN ('BASIC','PREMIUM','ENTERPRISE','MASTER'));

ALTER TABLE user_profiles ADD COLUMN telegram_chat_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_telegram_chat_id ON user_profiles(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_tier ON user_profiles(subscription_tier);
