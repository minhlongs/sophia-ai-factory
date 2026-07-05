-- Migration 0216: Add tenant_id to marketplace tables
--
-- Enables tenant isolation for the SOP Creator Marketplace:
-- creator_profiles, sop_listings, sop_installs, sop_reviews.
-- Existing rows receive tenant_id = 'default' automatically.

ALTER TABLE creator_profiles ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE sop_listings ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE sop_installs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE sop_reviews ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_creator_profiles_tenant_id ON creator_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sop_listings_tenant_id ON sop_listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sop_installs_tenant_id ON sop_installs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sop_reviews_tenant_id ON sop_reviews(tenant_id);

-- Verify
SELECT '0216: OK' AS migration_status FROM pragma_table_info('creator_profiles') WHERE name = 'tenant_id' LIMIT 1;
