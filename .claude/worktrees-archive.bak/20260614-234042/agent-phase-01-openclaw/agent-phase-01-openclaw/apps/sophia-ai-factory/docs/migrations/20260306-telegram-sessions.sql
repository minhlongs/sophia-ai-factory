-- Telegram Sessions Schema Migration
-- Migration: Redis → Supabase PostgreSQL
-- Date: 2026-03-06
-- Description: Replace Redis FSM state storage with persistent SQL sessions

-- ============================================================================
-- Enhancement: user_sessions table
-- Purpose: Add subscription tier and auth cache columns
-- ============================================================================

-- Add subscription_tier column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_sessions'
    AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE user_sessions ADD COLUMN subscription_tier TEXT;
  END IF;
END $$;

-- Add auth_cache column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_sessions'
    AND column_name = 'auth_cache'
  ) THEN
    ALTER TABLE user_sessions ADD COLUMN auth_cache JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add expires_at column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_sessions'
    AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE user_sessions ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Update trigger to handle new columns
CREATE OR REPLACE FUNCTION update_user_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS tr_update_user_sessions_timestamp ON user_sessions;
CREATE TRIGGER tr_update_user_sessions_timestamp
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sessions_updated_at();

-- ============================================================================
-- Table: telegram_user_mappings
-- Purpose: Map Telegram chat IDs to Supabase user IDs
-- Replaces Redis telegram:user:* keys
-- ============================================================================

CREATE TABLE IF NOT EXISTS telegram_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_telegram_user_mappings_chat_id
  ON telegram_user_mappings(telegram_chat_id);

CREATE INDEX IF NOT EXISTS idx_telegram_user_mappings_user_id
  ON telegram_user_mappings(user_id);

-- Enable RLS
ALTER TABLE telegram_user_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage mappings
CREATE POLICY "Service role can manage telegram user mappings"
  ON telegram_user_mappings FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Users can read their own mapping
CREATE POLICY "Users can read own telegram mapping"
  ON telegram_user_mappings FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER tr_update_telegram_user_mappings_timestamp
  BEFORE UPDATE ON telegram_user_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sessions_updated_at();

-- ============================================================================
-- Function: get_telegram_user_session
-- Purpose: Get or create session for a Telegram chat ID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_telegram_user_session(
  p_chat_id TEXT
)
RETURNS TABLE(
  session_id UUID,
  state TEXT,
  context_data JSONB,
  subscription_tier TEXT,
  auth_cache JSONB,
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Try to get existing session
  SELECT * INTO v_session
  FROM user_sessions
  WHERE telegram_chat_id = p_chat_id
    AND (expires_at IS NULL OR expires_at > NOW());

  IF v_session.id IS NULL THEN
    -- Create new session
    INSERT INTO user_sessions (telegram_chat_id, state, context_data)
    VALUES (p_chat_id, 'idle', '{}')
    RETURNING * INTO v_session;
  END IF;

  RETURN QUERY SELECT
    v_session.id,
    v_session.state,
    v_session.context_data,
    v_session.subscription_tier,
    v_session.auth_cache,
    v_session.expires_at;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

-- ============================================================================
-- Function: set_telegram_user_state
-- Purpose: Update FSM state for a Telegram chat ID
-- ============================================================================

CREATE OR REPLACE FUNCTION set_telegram_user_state(
  p_chat_id TEXT,
  p_state TEXT,
  p_context_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Upsert session
  INSERT INTO user_sessions (telegram_chat_id, state, context_data, updated_at)
  VALUES (p_chat_id, p_state, p_context_data, NOW())
  ON CONFLICT (telegram_chat_id) DO UPDATE SET
    state = EXCLUDED.state,
    context_data = EXCLUDED.context_data,
    updated_at = NOW()
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

-- ============================================================================
-- Function: link_telegram_user
-- Purpose: Link a Telegram chat ID to a Supabase user ID
-- ============================================================================

CREATE OR REPLACE FUNCTION link_telegram_user(
  p_chat_id TEXT,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_mapping_id UUID;
BEGIN
  -- Upsert mapping
  INSERT INTO telegram_user_mappings (telegram_chat_id, user_id, updated_at)
  VALUES (p_chat_id, p_user_id, NOW())
  ON CONFLICT (telegram_chat_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    updated_at = NOW()
  RETURNING id INTO v_mapping_id;

  -- Also update session subscription tier
  UPDATE user_sessions
  SET subscription_tier = (
    SELECT COALESCE(
      (p_user_id::TEXT || '_tier'),
      'BASIC'
    )
  )
  WHERE telegram_chat_id = p_chat_id;

  RETURN v_mapping_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

-- ============================================================================
-- Function: get_user_by_telegram_chat_id
-- Purpose: Get Supabase user ID from Telegram chat ID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_by_telegram_chat_id(
  p_chat_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM telegram_user_mappings
  WHERE telegram_chat_id = p_chat_id
  LIMIT 1;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

-- ============================================================================
-- Function: clear_telegram_session
-- Purpose: Clear FSM state for a Telegram chat ID
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_telegram_session(
  p_chat_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Reset session to idle with empty context
  UPDATE user_sessions
  SET state = 'idle',
      context_data = '{}',
      updated_at = NOW()
  WHERE telegram_chat_id = p_chat_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

-- ============================================================================
-- Function: update_session_subscription_tier
-- Purpose: Update subscription tier for a Telegram chat ID
-- ============================================================================

CREATE OR REPLACE FUNCTION update_session_subscription_tier(
  p_chat_id TEXT,
  p_tier TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update both session and mapping
  UPDATE user_sessions
  SET subscription_tier = p_tier,
      updated_at = NOW()
  WHERE telegram_chat_id = p_chat_id;

  UPDATE telegram_user_mappings
  SET subscription_tier = p_tier,
      updated_at = NOW()
  WHERE telegram_chat_id = p_chat_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE telegram_user_mappings IS 'Maps Telegram chat IDs to Supabase user IDs - replaces Redis';
COMMENT ON COLUMN telegram_user_mappings.subscription_tier IS 'User subscription tier (basic/premium/enterprise)';

COMMENT ON FUNCTION get_telegram_user_session IS 'Gets or creates a session for a Telegram chat ID';
COMMENT ON FUNCTION set_telegram_user_state IS 'Updates FSM state for a Telegram chat ID';
COMMENT ON FUNCTION link_telegram_user IS 'Links a Telegram chat ID to a Supabase user ID';
COMMENT ON FUNCTION get_user_by_telegram_chat_id IS 'Gets Supabase user ID from Telegram chat ID';
COMMENT ON FUNCTION clear_telegram_session IS 'Resets FSM state to idle for a chat ID';
COMMENT ON FUNCTION update_session_subscription_tier IS 'Updates subscription tier for a chat ID';

-- End of migration
