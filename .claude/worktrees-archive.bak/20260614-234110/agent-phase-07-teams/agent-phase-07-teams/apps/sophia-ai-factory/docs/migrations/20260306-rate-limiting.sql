-- Rate Limiting Schema Migration
-- Migration: Redis → Supabase PostgreSQL
-- Date: 2026-03-06
-- Description: Replace Upstash Redis rate limiting with SQL-based sliding window

-- ============================================================================
-- Table: rate_limits
-- Purpose: SQL-based rate limiting for API endpoints
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,           -- e.g., 'api:192.168.1.1', 'user:abc123'
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, window_start)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON rate_limits(identifier, window_start);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Service role only (backend operations)
CREATE POLICY "Service role can manage rate limits"
  ON rate_limits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Table: telegram_rate_limits
-- Purpose: SQL-based rate limiting for Telegram bot commands
-- ============================================================================

CREATE TABLE IF NOT EXISTS telegram_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT NOT NULL,
  command_timestamp TIMESTAMPTZ NOT NULL,
  command_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for sliding window queries
CREATE INDEX IF NOT EXISTS idx_telegram_rate_limits_chat_window
  ON telegram_rate_limits(telegram_chat_id, command_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_rate_limits_cleanup
  ON telegram_rate_limits(telegram_chat_id, command_timestamp);

-- Enable RLS
ALTER TABLE telegram_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Service role only (backend operations)
CREATE POLICY "Service role can manage telegram rate limits"
  ON telegram_rate_limits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Function: increment_rate_limit
-- Purpose: Atomic increment and count for sliding window rate limiting
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_identifier TEXT,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(current_count INTEGER) AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  -- Calculate window start (truncate to minute for grouping)
  v_window_start := date_trunc('minute', NOW());

  -- Delete expired entries (older than window)
  DELETE FROM rate_limits
  WHERE identifier = p_identifier
    AND window_start < (NOW() - (p_window_seconds || ' seconds')::INTERVAL);

  -- Get current count in window
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND window_start >= v_window_start;

  -- Insert or update current window
  INSERT INTO rate_limits (identifier, window_start, request_count)
  VALUES (p_identifier, v_window_start, 1)
  ON CONFLICT (identifier, window_start)
  DO UPDATE SET
    request_count = rate_limits.request_count + 1,
    created_at = NOW();

  -- Return the new count
  RETURN QUERY SELECT v_count + 1;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;  -- Run with elevated privileges for RLS bypass

-- ============================================================================
-- Function: check_telegram_rate_limit
-- Purpose: Check and increment Telegram command rate limit
-- ============================================================================

CREATE OR REPLACE FUNCTION check_telegram_rate_limit(
  p_chat_id TEXT,
  p_command_type TEXT DEFAULT 'command',
  p_max_requests INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  remaining INTEGER,
  oldest_timestamp TIMESTAMPTZ
) AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_oldest TIMESTAMPTZ;
BEGIN
  -- Calculate window boundary
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  -- Delete expired entries
  DELETE FROM telegram_rate_limits
  WHERE telegram_chat_id = p_chat_id
    AND command_timestamp < v_window_start;

  -- Get current count and oldest timestamp in window
  SELECT
    COUNT(*),
    MIN(command_timestamp)
  INTO v_count, v_oldest
  FROM telegram_rate_limits
  WHERE telegram_chat_id = p_chat_id
    AND command_timestamp >= v_window_start;

  -- Check if limit exceeded
  IF v_count >= p_max_requests THEN
    -- Return current state without incrementing
    RETURN QUERY SELECT
      FALSE,
      v_count::INTEGER,
      0,
      v_oldest;
  ELSE
    -- Insert new request
    INSERT INTO telegram_rate_limits (telegram_chat_id, command_timestamp, command_type)
    VALUES (p_chat_id, NOW(), p_command_type);

    -- Return updated state
    RETURN QUERY SELECT
      TRUE,
      (v_count + 1)::INTEGER,
      (p_max_requests - v_count - 1)::INTEGER,
      CASE WHEN v_oldest IS NULL THEN NOW() ELSE v_oldest END;
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

-- ============================================================================
-- Function: cleanup_expired_rate_limits
-- Purpose: Periodic cleanup of expired rate limit entries
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits(
  p_retention_hours INTEGER DEFAULT 24
)
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
  v_count BIGINT;
BEGIN
  -- Delete rate_limits older than retention period
  WITH deleted AS (
    DELETE FROM rate_limits
    WHERE window_start < (NOW() - (p_retention_hours || ' hours')::INTERVAL)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  -- Delete telegram_rate_limits older than retention period
  WITH deleted_telegram AS (
    DELETE FROM telegram_rate_limits
    WHERE command_timestamp < (NOW() - (p_retention_hours || ' hours')::INTERVAL)
    RETURNING 1
  )
  SELECT v_count + COUNT(*) INTO v_count FROM deleted_telegram;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE rate_limits IS 'SQL-based rate limiting for API endpoints - replaces Redis';
COMMENT ON COLUMN rate_limits.identifier IS 'Unique key: type:user_id or type:ip_address';
COMMENT ON COLUMN rate_limits.window_start IS 'Start of current rate limit window';
COMMENT ON COLUMN rate_limits.request_count IS 'Number of requests in current window';

COMMENT ON TABLE telegram_rate_limits IS 'SQL-based rate limiting for Telegram bot commands';
COMMENT ON COLUMN telegram_rate_limits.telegram_chat_id IS 'Telegram chat ID';
COMMENT ON COLUMN telegram_rate_limits.command_timestamp IS 'Timestamp of command execution';
COMMENT ON COLUMN telegram_rate_limits.command_type IS 'Type of command (for analytics)';

COMMENT ON FUNCTION increment_rate_limit IS 'Atomically increments and returns count for rate limiting';
COMMENT ON FUNCTION check_telegram_rate_limit IS 'Checks and increments Telegram rate limit, returns allowed status';
COMMENT ON FUNCTION cleanup_expired_rate_limits IS 'Deletes expired rate limit entries older than retention period';

-- End of migration
