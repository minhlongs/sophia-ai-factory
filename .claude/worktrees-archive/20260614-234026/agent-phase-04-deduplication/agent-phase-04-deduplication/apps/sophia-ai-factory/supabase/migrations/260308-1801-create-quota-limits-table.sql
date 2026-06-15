-- ============================================================================
-- Table: quota_limits
-- Purpose: Custom quota limits per license (override tier defaults)
-- Created: 2026-03-08
-- ============================================================================

CREATE TABLE IF NOT EXISTS quota_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_nonce TEXT NOT NULL UNIQUE REFERENCES raas_licenses(nonce) ON DELETE CASCADE,

  -- Custom limits (NULL = use default from QUOTA_LIMITS constant)
  custom_daily_credits INTEGER,
  custom_hourly_credits INTEGER,
  custom_monthly_credits INTEGER,
  custom_daily_requests INTEGER,

  -- Overage billing settings
  overage_allowed BOOLEAN DEFAULT false,      -- Allow overage (don't block, just log)
  overage_price_per_credit DECIMAL(10,4),     -- Price per overage credit in USD
  overage_hard_limit INTEGER,                 -- Absolute max (even if overage allowed)

  -- Warning thresholds (percentage 0-100)
  soft_warning_threshold INTEGER DEFAULT 80,  -- Show warning at 80% usage
  hard_block_threshold INTEGER DEFAULT 100,   -- Block at 100% (or custom)

  -- Metadata
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT,
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_quota_limits_license ON quota_limits(license_nonce);

-- RLS
ALTER TABLE quota_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Admins have full access
CREATE POLICY "Admins have full access to quota_limits"
  ON quota_limits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Users can view their own quota limits (via license relationship)
CREATE POLICY "Users can view own quota limits"
  ON quota_limits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM raas_licenses
      WHERE raas_licenses.nonce = quota_limits.license_nonce
      AND raas_licenses.created_by = auth.uid()
    )
  );

COMMENT ON TABLE quota_limits IS 'Custom quota limits per license, override tier defaults';
COMMENT ON COLUMN quota_limits.overage_allowed IS 'If true, allow usage beyond limits (billable overage)';
COMMENT ON COLUMN quota_limits.overage_price_per_credit IS 'USD price per credit for overage billing';
COMMENT ON COLUMN quota_limits.overage_hard_limit IS 'Absolute maximum credits before hard block (even if overage_allowed)';
