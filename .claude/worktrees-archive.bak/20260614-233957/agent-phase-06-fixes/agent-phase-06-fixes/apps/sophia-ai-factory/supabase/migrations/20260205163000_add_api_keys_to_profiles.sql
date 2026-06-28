-- Add api_keys column to user_profiles for storing encrypted keys
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{}'::jsonb;

-- Comment to explain usage
COMMENT ON COLUMN user_profiles.api_keys IS 'Encrypted API keys for external services (OpenAI, etc.)';
