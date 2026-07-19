-- Migration 0213: SOP listings for Marketplace
--
-- Published SOP templates created by marketplace creators.
-- Each listing belongs to exactly one creator profile.

CREATE TABLE IF NOT EXISTS sop_listings (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  category TEXT,
  tags TEXT,
  thumbnail_url TEXT,
  demo_video_url TEXT,
  sop_template_id TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  install_count INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (creator_id) REFERENCES creator_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_sop_listings_creator_id ON sop_listings(creator_id);
CREATE INDEX IF NOT EXISTS idx_sop_listings_status ON sop_listings(status);
CREATE INDEX IF NOT EXISTS idx_sop_listings_category ON sop_listings(category);
CREATE INDEX IF NOT EXISTS idx_sop_listings_rating ON sop_listings(rating DESC);

-- Verify
SELECT '0213: OK' AS migration_status FROM sop_listings LIMIT 1;
