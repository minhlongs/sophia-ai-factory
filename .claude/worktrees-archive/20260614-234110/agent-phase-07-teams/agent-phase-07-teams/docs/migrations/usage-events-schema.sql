-- ============================================================================
-- Migration: Usage Events Table for AI Service Metering
-- Created: 2026-03-07
-- Purpose: Track all AI service API calls with token/credit consumption
-- ============================================================================

-- ============================================================================
-- Table: usage_events
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Attribution
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  license_key_hash TEXT NOT NULL,        -- SHA256 hash of license key
  license_nonce TEXT NOT NULL,           -- Denormalized for faster queries

  -- Service info
  service_name TEXT NOT NULL,            -- heygen | elevenlabs | openrouter
  endpoint TEXT NOT NULL,                -- API endpoint called
  action TEXT NOT NULL,                  -- create_video | text_to_speech | chat_completion

  -- Usage metrics
  tokens_input INTEGER DEFAULT 0,        -- Input tokens (LLM)
  tokens_output INTEGER DEFAULT 0,       -- Output tokens (LLM)
  credits_used INTEGER NOT NULL DEFAULT 1, -- Normalized credits (1 credit = 1 API call or 1K tokens)

  -- Request metadata
  request_id TEXT,                       -- External API request ID
  model_name TEXT,                       -- Model used (e.g., claude-3.5-sonnet)
  tier_at_request TEXT NOT NULL,         -- User's tier at time of request

  -- Response info
  status_code INTEGER,                   -- HTTP status from API
  error_message TEXT,                    -- Error if failed
  response_time_ms INTEGER,              -- API response time in milliseconds

  -- Timestamps
  created_at BIGINT NOT NULL             -- Unix timestamp (seconds)
);

-- ============================================================================
-- Indexes: Performance optimization
-- ============================================================================

-- User lookups
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_created ON usage_events(user_id, created_at DESC);

-- License lookups
CREATE INDEX IF NOT EXISTS idx_usage_events_license_hash ON usage_events(license_key_hash);
CREATE INDEX IF NOT EXISTS idx_usage_events_license_nonce ON usage_events(license_nonce);

-- Service/endpoint queries
CREATE INDEX IF NOT EXISTS idx_usage_events_service ON usage_events(service_name);
CREATE INDEX IF NOT EXISTS idx_usage_events_service_action ON usage_events(service_name, action);

-- Time-based queries (billing periods)
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_period ON usage_events(created_at, service_name);

-- Composite for common aggregations
CREATE INDEX IF NOT EXISTS idx_usage_events_billing ON usage_events(license_nonce, created_at, service_name);

-- ============================================================================
-- RLS (Row Level Security) Policies
-- ============================================================================

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Admins have full access
DROP POLICY IF EXISTS "Admins have full access to usage_events" ON usage_events;
CREATE POLICY "Admins have full access to usage_events"
  ON usage_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Users can view their own usage
DROP POLICY IF EXISTS "Users can view own usage events" ON usage_events;
CREATE POLICY "Users can view own usage events"
  ON usage_events
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- Service role can insert all events
DROP POLICY IF EXISTS "Service role can insert usage events" ON usage_events;
CREATE POLICY "Service role can insert usage events"
  ON usage_events
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Get usage summary for a license in a date range
CREATE OR REPLACE FUNCTION get_usage_summary(
  p_license_nonce TEXT,
  p_start_timestamp BIGINT,
  p_end_timestamp BIGINT
)
RETURNS TABLE (
  service_name TEXT,
  total_requests BIGINT,
  total_tokens_input BIGINT,
  total_tokens_output BIGINT,
  total_credits BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ue.service_name,
    COUNT(*)::BIGINT as total_requests,
    COALESCE(SUM(ue.tokens_input), 0)::BIGINT as total_tokens_input,
    COALESCE(SUM(ue.tokens_output), 0)::BIGINT as total_tokens_output,
    COALESCE(SUM(ue.credits_used), 0)::BIGINT as total_credits
  FROM usage_events ue
  WHERE ue.license_nonce = p_license_nonce
    AND ue.created_at >= p_start_timestamp
    AND ue.created_at <= p_end_timestamp
  GROUP BY ue.service_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get daily usage breakdown
CREATE OR REPLACE FUNCTION get_daily_usage(
  p_license_nonce TEXT,
  p_start_timestamp BIGINT,
  p_end_timestamp BIGINT
)
RETURNS TABLE (
  day_timestamp BIGINT,
  service_name TEXT,
  requests BIGINT,
  credits BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (ue.created_at - (ue.created_at % 86400))::BIGINT as day_timestamp,
    ue.service_name,
    COUNT(*)::BIGINT as requests,
    COALESCE(SUM(ue.credits_used), 0)::BIGINT as credits
  FROM usage_events ue
  WHERE ue.license_nonce = p_license_nonce
    AND ue.created_at >= p_start_timestamp
    AND ue.created_at <= p_end_timestamp
  GROUP BY day_timestamp, ue.service_name
  ORDER BY day_timestamp, ue.service_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE usage_events IS 'AI service usage tracking for billing attribution';
COMMENT ON COLUMN usage_events.license_key_hash IS 'SHA256 hash of license key for secure lookup';
COMMENT ON COLUMN usage_events.credits_used IS 'Normalized credits: 1 per API call or 1 per 1K tokens';
COMMENT ON COLUMN usage_events.tier_at_request IS 'User tier at time of request (for tiered billing)';
