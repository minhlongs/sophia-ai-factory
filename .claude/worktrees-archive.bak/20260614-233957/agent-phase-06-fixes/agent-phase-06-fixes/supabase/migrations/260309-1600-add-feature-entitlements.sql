-- ============================================================================
-- Migration: 260309-1600-add-feature-entitlements
-- Description: Add feature entitlements support for ROIaaS license metering
-- Date: 2026-03-09
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add feature_entitlements to raas_licenses
-- Purpose: Store array of feature keys entitled to each license
-- ----------------------------------------------------------------------------
ALTER TABLE raas_licenses
  ADD COLUMN IF NOT EXISTS feature_entitlements JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN raas_licenses.feature_entitlements IS
  'Array of feature keys entitled to this license, e.g., ["heygen.createVideo", "d-id.createAvatar"]';

-- ----------------------------------------------------------------------------
-- 2. Create raas_feature_entitlements table
-- Purpose: Granular feature-level entitlements with per-feature limits
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raas_feature_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_nonce TEXT NOT NULL REFERENCES raas_licenses(nonce) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  daily_limit INTEGER,
  monthly_limit INTEGER,
  max_tokens INTEGER,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(license_nonce, feature_key)
);

-- Index for fast lookups by license and feature
CREATE INDEX IF NOT EXISTS idx_raas_feature_entitlements_license
  ON raas_feature_entitlements(license_nonce, feature_key);

COMMENT ON TABLE raas_feature_entitlements IS
  'Granular feature-level entitlements linked to RaaS licenses via nonce';

COMMENT ON COLUMN raas_feature_entitlements.license_nonce IS
  'Reference to raas_licenses.nonce (non-UUID, matches license identifier)';

COMMENT ON COLUMN raas_feature_entitlements.feature_key IS
  'Feature identifier in format: service.endpoint, e.g., "heygen.createVideo"';

COMMENT ON COLUMN raas_feature_entitlements.daily_limit IS
  'Maximum operations per day for this feature (NULL = unlimited)';

COMMENT ON COLUMN raas_feature_entitlements.monthly_limit IS
  'Maximum operations per month for this feature (NULL = unlimited)';

COMMENT ON COLUMN raas_feature_entitlements.max_tokens IS
  'Maximum tokens consumed per operation for this feature (NULL = unlimited)';

-- ----------------------------------------------------------------------------
-- 3. Add feature_limits to quota_limits
-- Purpose: Store per-feature limits in quota configuration
-- ----------------------------------------------------------------------------
ALTER TABLE quota_limits
  ADD COLUMN IF NOT EXISTS feature_limits JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN quota_limits.feature_limits IS
  'Per-feature limits JSON: {"heygen.createVideo": {"daily": 10, "monthly": 300}}';

-- ----------------------------------------------------------------------------
-- 4. Add trigger to ensure feature_name population in usage_events
-- Purpose: Auto-populate feature_name from service.endpoint if not provided
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_feature_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-generate feature_name from service.endpoint if NULL
  IF NEW.feature_name IS NULL THEN
    NEW.feature_name := COALESCE(NEW.service, 'unknown') || '.' || COALESCE(NEW.endpoint, 'unknown');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists (to avoid conflicts)
DROP TRIGGER IF EXISTS trg_ensure_feature_name ON usage_events;

-- Create trigger on usage_events table
CREATE TRIGGER trg_ensure_feature_name
  BEFORE INSERT OR UPDATE ON usage_events
  FOR EACH ROW
  EXECUTE FUNCTION ensure_feature_name();

COMMENT ON FUNCTION ensure_feature_name() IS
  'Trigger function to auto-populate feature_name from service.endpoint format';

COMMENT ON TRIGGER trg_ensure_feature_name ON usage_events IS
  'Ensures feature_name is always populated for usage tracking consistency';

-- ----------------------------------------------------------------------------
-- Migration Complete
-- ----------------------------------------------------------------------------
