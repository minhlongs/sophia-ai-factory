-- ============================================================================
-- Migration: Add Tenant Attribution Columns for Multi-Tenant Usage Tracking
-- Date: 2026-03-09
-- Purpose: Enable multi-tenant usage attribution across RaaS tables
-- ============================================================================

-- ============================================================================
-- 1. usage_events - Add tenant attribution
-- ============================================================================

-- Add tenant_id for direct user reference (UUID from auth.users)
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add agency_id for agency/organization grouping
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS agency_id TEXT;

-- Add product_context for product/module identification
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS product_context TEXT;

-- Add feature_name for granular feature-level tracking
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS feature_name TEXT;

-- Create indexes for efficient tenant-based queries
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_id
  ON usage_events(tenant_id);

CREATE INDEX IF NOT EXISTS idx_usage_events_agency_id
  ON usage_events(agency_id);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_timestamp
  ON usage_events(tenant_id, event_timestamp DESC);

-- Add comments for documentation
COMMENT ON COLUMN usage_events.tenant_id IS 'Tenant user ID for multi-tenant attribution (references auth.users)';
COMMENT ON COLUMN usage_events.agency_id IS 'Agency/organization ID for grouping multiple tenants';
COMMENT ON COLUMN usage_events.product_context IS 'Product or module context (e.g., "content-factory", "analytics")';
COMMENT ON COLUMN usage_events.feature_name IS 'Specific feature name within product (e.g., "video-render", "voice-synthesis")';


-- ============================================================================
-- 2. overage_events - Add tenant attribution
-- ============================================================================

-- Add tenant_id for direct user reference
ALTER TABLE overage_events
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add agency_id for agency/organization grouping
ALTER TABLE overage_events
  ADD COLUMN IF NOT EXISTS agency_id TEXT;

-- Create index for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_overage_events_tenant_id
  ON overage_events(tenant_id);

-- Add comments
COMMENT ON COLUMN overage_events.tenant_id IS 'Tenant user ID for multi-tenant attribution (references auth.users)';
COMMENT ON COLUMN overage_events.agency_id IS 'Agency/organization ID for grouping multiple tenants';


-- ============================================================================
-- 3. raas_licenses - Add tenant attribution
-- ============================================================================

-- Add tenant_id for direct user reference
ALTER TABLE raas_licenses
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add agency_id for agency/organization grouping
ALTER TABLE raas_licenses
  ADD COLUMN IF NOT EXISTS agency_id TEXT;

-- Add product_context for product/module identification
ALTER TABLE raas_licenses
  ADD COLUMN IF NOT EXISTS product_context TEXT;

-- Create index for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_raas_licenses_tenant_id
  ON raas_licenses(tenant_id);

-- Add comments
COMMENT ON COLUMN raas_licenses.tenant_id IS 'Tenant user ID for multi-tenant attribution (references auth.users)';
COMMENT ON COLUMN raas_licenses.agency_id IS 'Agency/organization ID for grouping multiple tenants';
COMMENT ON COLUMN raas_licenses.product_context IS 'Product or module context this license belongs to';


-- ============================================================================
-- 4. raas_api_keys - Add tenant attribution
-- ============================================================================

-- Add tenant_id for direct user reference
ALTER TABLE raas_api_keys
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add agency_id for agency/organization grouping
ALTER TABLE raas_api_keys
  ADD COLUMN IF NOT EXISTS agency_id TEXT;

-- Add product_context for product/module identification
ALTER TABLE raas_api_keys
  ADD COLUMN IF NOT EXISTS product_context TEXT;

-- Create index for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_tenant_id
  ON raas_api_keys(tenant_id);

-- Add comments
COMMENT ON COLUMN raas_api_keys.tenant_id IS 'Tenant user ID for multi-tenant attribution (references auth.users)';
COMMENT ON COLUMN raas_api_keys.agency_id IS 'Agency/organization ID for grouping multiple tenants';
COMMENT ON COLUMN raas_api_keys.product_context IS 'Product or module context this API key is used for';


-- ============================================================================
-- 5. Row Level Security (RLS) Policies for Tenant Isolation
-- ============================================================================

-- usage_events RLS: Tenants can only view their own usage events
CREATE POLICY IF NOT EXISTS "tenants_can_view_own_usage_events"
  ON usage_events FOR SELECT
  USING (
    tenant_id = auth.uid() OR
    agency_id IN (
      SELECT agency_id FROM usage_events ue2
      WHERE ue2.tenant_id = auth.uid() AND ue2.agency_id IS NOT NULL
    ) OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'service_role')
    )
  );

-- usage_events RLS: Service role can insert with tenant attribution
CREATE POLICY IF NOT EXISTS "service_role_can_insert_usage_events"
  ON usage_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'service_role'
    )
  );

-- usage_events RLS: Admins can manage all events
CREATE POLICY IF NOT EXISTS "admins_can_manage_all_usage_events"
  ON usage_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- overage_events RLS: Tenants can only view their own overage events
CREATE POLICY IF NOT EXISTS "tenants_can_view_own_overage_events"
  ON overage_events FOR SELECT
  USING (
    tenant_id = auth.uid() OR
    agency_id IN (
      SELECT agency_id FROM overage_events oe2
      WHERE oe2.tenant_id = auth.uid() AND oe2.agency_id IS NOT NULL
    ) OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'service_role')
    )
  );

-- overage_events RLS: Service role can insert with tenant attribution
CREATE POLICY IF NOT EXISTS "service_role_can_insert_overage_events"
  ON overage_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'service_role'
    )
  );

-- overage_events RLS: Admins can manage all events
CREATE POLICY IF NOT EXISTS "admins_can_manage_all_overage_events"
  ON overage_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- raas_licenses RLS: Tenants can only view their own licenses
CREATE POLICY IF NOT EXISTS "tenants_can_view_own_licenses"
  ON raas_licenses FOR SELECT
  USING (
    tenant_id::text = auth.uid() OR
    agency_id IN (
      SELECT agency_id FROM raas_licenses rl2
      WHERE rl2.tenant_id::text = auth.uid() AND rl2.agency_id IS NOT NULL
    ) OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'service_role')
    )
  );

-- raas_api_keys RLS: Tenants can only view their own API keys
CREATE POLICY IF NOT EXISTS "tenants_can_view_own_api_keys"
  ON raas_api_keys FOR SELECT
  USING (
    tenant_id::text = auth.uid() OR
    agency_id IN (
      SELECT agency_id FROM raas_api_keys rak2
      WHERE rak2.tenant_id::text = auth.uid() AND rak2.agency_id IS NOT NULL
    ) OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'service_role')
    )
  );


-- ============================================================================
-- 6. Verification Queries (uncomment to run after migration)
-- ============================================================================

-- Verify usage_events columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'usage_events'
-- AND column_name IN ('tenant_id', 'agency_id', 'product_context', 'feature_name');

-- Verify overage_events columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'overage_events'
-- AND column_name IN ('tenant_id', 'agency_id');

-- Verify raas_licenses columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'raas_licenses'
-- AND column_name IN ('tenant_id', 'agency_id', 'product_context');

-- Verify raas_api_keys columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'raas_api_keys'
-- AND column_name IN ('tenant_id', 'agency_id', 'product_context');

-- Verify indexes
-- SELECT indexname, tablename
-- FROM pg_indexes
-- WHERE tablename IN ('usage_events', 'overage_events', 'raas_licenses', 'raas_api_keys')
-- AND indexname LIKE '%tenant%';

-- Verify RLS policies
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('usage_events', 'overage_events', 'raas_licenses', 'raas_api_keys');


-- ============================================================================
-- Migration Complete
-- ============================================================================
