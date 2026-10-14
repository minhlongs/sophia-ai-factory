-- Migration 0474: Reconcile SOP Marketplace Schema (Forward-Only V1 + V2 Merge)
--
-- Reconciles Production D1 drift where:
--   1. sop_listings remained on migration 0126 (V1) schema while ledger recorded 0213/0216.
--   2. sop_installs and sop_reviews were absent from sqlite_master while ledger recorded 0214/0215/0216.
--   3. creator_profiles was missing named indexes from 0212/0216.
--
-- Preserves all V1 columns, defaults, existing rows, and indexes on sop_listings.
-- Adds V2 columns and indexes from 0213 and 0216 without fabricating cross-schema template ID mappings.
-- Does NOT create idx_sop_installs_user_listing_active (owned by migration 0473 after reconciliation).
--
-- D1 Foreign Key & Transaction Note:
--   Cloudflare D1 executes migrations inside an implicit transaction with foreign_keys = ON,
--   where PRAGMA foreign_keys = OFF/ON is a SQLite no-op. Because preflight_reconcile_0474
--   verifies zero inbound foreign keys referencing sop_listings and sop_installs/sop_reviews
--   are created only AFTER sop_listings_new is renamed to sop_listings, immediate foreign key
--   enforcement remains valid at every statement without PRAGMA foreign_keys = OFF or
--   PRAGMA defer_foreign_keys.

-- ============================================================================
-- 1. Rebuild sop_listings with unified V1 (0126) + V2 (0213, 0216) schema
--    Fails closed if temporary table sop_listings_new already exists.
-- ============================================================================
CREATE TABLE sop_listings_new (
  id TEXT PRIMARY KEY,
  template_id TEXT UNIQUE,
  creator_id TEXT,
  title TEXT,
  description TEXT,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  preview_md TEXT,
  category TEXT,
  tags TEXT,
  thumbnail_url TEXT,
  demo_video_url TEXT,
  sop_template_id TEXT,
  total_sales INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,
  rating_avg REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  install_count INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  status TEXT CHECK(status IN ('pending_review','published','rejected','suspended','draft','archived')) NOT NULL DEFAULT 'pending_review',
  rejection_reason TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  CHECK (
    (template_id IS NOT NULL)
    OR (creator_id IS NOT NULL AND title IS NOT NULL AND sop_template_id IS NOT NULL)
  ),
  FOREIGN KEY (creator_id) REFERENCES creator_profiles(id)
);

INSERT INTO sop_listings_new (
  id,
  template_id,
  price_cents,
  currency,
  preview_md,
  demo_video_url,
  tags,
  total_sales,
  total_revenue_cents,
  rating_avg,
  rating_count,
  status,
  rejection_reason,
  published_at,
  created_at,
  updated_at
)
SELECT
  id,
  template_id,
  price_cents,
  currency,
  preview_md,
  demo_video_url,
  tags,
  total_sales,
  total_revenue_cents,
  rating_avg,
  rating_count,
  status,
  rejection_reason,
  published_at,
  created_at,
  updated_at
FROM sop_listings;

DROP TABLE sop_listings;
ALTER TABLE sop_listings_new RENAME TO sop_listings;

-- Restore V1 indexes (0126)
CREATE INDEX idx_listing_status ON sop_listings(status, published_at DESC);
CREATE INDEX idx_listing_template ON sop_listings(template_id);

-- Add V2 indexes (0213, 0216)
CREATE INDEX idx_sop_listings_creator_id ON sop_listings(creator_id);
CREATE INDEX idx_sop_listings_status ON sop_listings(status);
CREATE INDEX idx_sop_listings_category ON sop_listings(category);
CREATE INDEX idx_sop_listings_rating ON sop_listings(rating DESC);
CREATE INDEX idx_sop_listings_tenant_id ON sop_listings(tenant_id);

-- ============================================================================
-- 2. Create sop_installs (0214 + 0216 tenant_id)
--    Fails closed if sop_installs already exists in a partial state.
-- ============================================================================
CREATE TABLE sop_installs (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  license_id TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL,
  commission_id TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','uninstalled')),
  installed_at INTEGER NOT NULL,
  uninstalled_at INTEGER,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  FOREIGN KEY (listing_id) REFERENCES sop_listings(id),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE INDEX idx_sop_installs_listing_id ON sop_installs(listing_id);
CREATE INDEX idx_sop_installs_user_id ON sop_installs(user_id);
CREATE INDEX idx_sop_installs_license_id ON sop_installs(license_id);
CREATE INDEX idx_sop_installs_status ON sop_installs(status);
CREATE INDEX idx_sop_installs_user_status ON sop_installs(user_id, status);
CREATE INDEX idx_sop_installs_tenant_id ON sop_installs(tenant_id);

-- ============================================================================
-- 3. Create sop_reviews (0215 + 0216 tenant_id)
--    Fails closed if sop_reviews already exists in a partial state.
-- ============================================================================
CREATE TABLE sop_reviews (
  id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at INTEGER NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  FOREIGN KEY (install_id) REFERENCES sop_installs(id),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE INDEX idx_sop_reviews_install_id ON sop_reviews(install_id);
CREATE INDEX idx_sop_reviews_user_id ON sop_reviews(user_id);
CREATE INDEX idx_sop_reviews_rating ON sop_reviews(rating);
CREATE INDEX idx_sop_reviews_tenant_id ON sop_reviews(tenant_id);

-- ============================================================================
-- 4. Restore missing named indexes on creator_profiles (0212 + 0216)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_creator_profiles_user_id ON creator_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_status ON creator_profiles(status);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_tenant_id ON creator_profiles(tenant_id);
