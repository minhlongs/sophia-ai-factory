-- Usage Metering - Rollup Summary Tables
-- Date: 2026-03-07
-- Purpose: Create hourly and daily summary tables for aggregated usage metrics

-- =====================================================
-- usage_hourly_summary table
-- =====================================================

CREATE TABLE IF NOT EXISTS usage_hourly_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Time window
  hour_timestamp INTEGER NOT NULL, -- Unix timestamp of hour start

  -- Tenant identification
  tenant_id TEXT NOT NULL, -- user_id
  license_nonce TEXT NOT NULL,
  external_customer_id TEXT, -- Polar/Stripe customer ID for billing

  -- Aggregated metrics
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  total_tokens_input INTEGER NOT NULL DEFAULT 0,
  total_tokens_output INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms NUMERIC(10,2) DEFAULT 0,

  -- Breakdown by service
  service_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{"service":"heygen","requests":10,"credits":10,"tokens_input":0,"tokens_output":0,"errors":0}]

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for idempotent rollup
CREATE UNIQUE INDEX idx_hourly_summary_unique
  ON usage_hourly_summary(hour_timestamp, tenant_id, license_nonce);

-- Indexes for common queries
CREATE INDEX idx_hourly_summary_timestamp
  ON usage_hourly_summary(hour_timestamp DESC);

CREATE INDEX idx_hourly_summary_tenant
  ON usage_hourly_summary(tenant_id, hour_timestamp DESC);

CREATE INDEX idx_hourly_summary_external_customer
  ON usage_hourly_summary(external_customer_id)
  WHERE external_customer_id IS NOT NULL;

-- =====================================================
-- usage_daily_summary table
-- =====================================================

CREATE TABLE IF NOT EXISTS usage_daily_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Time window
  day_timestamp INTEGER NOT NULL, -- Unix timestamp of day start (00:00:00 UTC)

  -- Tenant identification
  tenant_id TEXT NOT NULL,
  license_nonce TEXT NOT NULL,
  external_customer_id TEXT,

  -- Aggregated metrics
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  total_tokens_input INTEGER NOT NULL DEFAULT 0,
  total_tokens_output INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms NUMERIC(10,2) DEFAULT 0,

  -- Hourly breakdown for drill-down
  hourly_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{"hour":1709856000,"requests":10,"credits":10,...}]

  -- Service breakdown
  service_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for idempotent rollup
CREATE UNIQUE INDEX idx_daily_summary_unique
  ON usage_daily_summary(day_timestamp, tenant_id, license_nonce);

-- Indexes for common queries
CREATE INDEX idx_daily_summary_timestamp
  ON usage_daily_summary(day_timestamp DESC);

CREATE INDEX idx_daily_summary_tenant
  ON usage_daily_summary(tenant_id, day_timestamp DESC);

CREATE INDEX idx_daily_summary_external_customer
  ON usage_daily_summary(external_customer_id)
  WHERE external_customer_id IS NOT NULL;

-- =====================================================
-- usage_quota_usage table (for quota tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS usage_quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Time window
  window_type TEXT NOT NULL CHECK (window_type IN ('hourly', 'daily', 'monthly')),
  window_start INTEGER NOT NULL, -- Unix timestamp
  window_end INTEGER NOT NULL,

  -- Tenant identification
  tenant_id TEXT NOT NULL,
  license_nonce TEXT NOT NULL,
  tier TEXT NOT NULL,

  -- Quota consumption
  credits_used INTEGER NOT NULL DEFAULT 0,
  requests_used INTEGER NOT NULL DEFAULT 0,

  -- Limits (snapshot at time of recording)
  credit_limit INTEGER NOT NULL,
  request_limit INTEGER NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint
CREATE UNIQUE INDEX idx_quota_usage_unique
  ON usage_quota_usage(window_type, window_start, tenant_id, license_nonce);

-- Indexes
CREATE INDEX idx_quota_usage_tenant
  ON usage_quota_usage(tenant_id, window_type, window_start DESC);

CREATE INDEX idx_quota_usage_window
  ON usage_quota_usage(window_type, window_start DESC);

-- =====================================================
-- RLS Policies (if not already enabled)
-- =====================================================

-- Enable RLS
ALTER TABLE usage_hourly_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_quota_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own data
CREATE POLICY "Users can view own hourly summary"
  ON usage_hourly_summary
  FOR SELECT
  USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can view own daily summary"
  ON usage_daily_summary
  FOR SELECT
  USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can view own quota usage"
  ON usage_quota_usage
  FOR SELECT
  USING (tenant_id = auth.uid()::TEXT);

-- Service role can do everything (for cron jobs)
CREATE POLICY "Service role full access hourly"
  ON usage_hourly_summary
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access daily"
  ON usage_daily_summary
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access quota"
  ON usage_quota_usage
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE usage_hourly_summary IS 'Hourly aggregated usage metrics for billing and analytics';
COMMENT ON TABLE usage_daily_summary IS 'Daily aggregated usage metrics with hourly drill-down';
COMMENT ON TABLE usage_quota_usage IS 'Quota consumption tracking per tenant per time window';

COMMENT ON COLUMN usage_hourly_summary.service_breakdown IS 'JSON array of per-service metrics: [{service, requests, credits, tokens_input, tokens_output, errors}]';
COMMENT ON COLUMN usage_daily_summary.hourly_breakdown IS 'JSON array of hourly metrics for drill-down: [{hour, requests, credits, ...}]';
COMMENT ON COLUMN usage_daily_summary.service_breakdown IS 'JSON array of per-service daily totals';

-- =====================================================
-- Verification queries
-- =====================================================

-- Verify tables created
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'usage_%_summary';

-- Verify indexes
-- SELECT indexname FROM pg_indexes WHERE tablename LIKE 'usage_%_summary';

-- Verify RLS policies
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename LIKE 'usage_%_summary';
