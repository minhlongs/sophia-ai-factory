-- Sophia Index: Core Database Schema
-- Created: 2026-02-05
-- Purpose: Affiliate product intelligence database for Auto-Discovery Engine

-- ============================================================================
-- TABLE: affiliate_products
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source Tracking
  external_id TEXT NOT NULL,
  network_id TEXT NOT NULL CHECK (network_id IN ('clickbank', 'shareasale', 'amazon')),

  -- Product Information
  title TEXT NOT NULL,
  description TEXT,
  affiliate_link TEXT NOT NULL,
  thumbnail_url TEXT,

  -- Pricing & Commission (Normalized)
  price_usd DECIMAL(10,2),
  commission_rate DECIMAL(5,4), -- 0.7500 = 75%
  avg_earnings_usd DECIMAL(10,2), -- Expected earnings per sale

  -- Raw Network Metrics (JSONB for flexibility)
  raw_metrics JSONB DEFAULT '{}',
  -- Examples:
  -- ClickBank: {"gravity": 45.2, "rebill": true, "initial_sale": 47.00}
  -- ShareASale: {"powerRank": 150, "epc": 12.50, "reversalRate": 0.02}
  -- Amazon: {"salesRank": 1234, "rating": 4.5, "reviews": 2890}

  -- Sophia Intelligence (Calculated Fields)
  sps_score DECIMAL(5,2), -- Sophia Potential Score: 0-100
  is_hidden_gem BOOLEAN DEFAULT FALSE,

  -- Taxonomy
  category_id INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(network_id, external_id)
);

-- ============================================================================
-- TABLE: affiliate_metric_history
-- ============================================================================
-- Tracks metric changes over time for velocity calculation
CREATE TABLE IF NOT EXISTS affiliate_metric_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES affiliate_products(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('gravity', 'rank', 'epc', 'sales_count', 'sps_score')),
  value DECIMAL(10,2) NOT NULL,

  -- Index for efficient time-series queries
  CONSTRAINT unique_product_metric_time UNIQUE(product_id, metric_type, recorded_at)
);

-- ============================================================================
-- TABLE: affiliate_categories
-- ============================================================================
-- Canonical category taxonomy (maps 100+ network categories to 12 core niches)
CREATE TABLE IF NOT EXISTS affiliate_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES affiliate_categories(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES (Performance Optimization)
-- ============================================================================
-- Primary Query Patterns:
-- 1. Top 50 by SPS score (DESC)
-- 2. Filter by network/category
-- 3. Find Hidden Gems
-- 4. Search by title/description
-- 5. Time-series metric analysis

CREATE INDEX idx_affiliate_products_sps_score ON affiliate_products(sps_score DESC);
CREATE INDEX idx_affiliate_products_network ON affiliate_products(network_id);
CREATE INDEX idx_affiliate_products_category ON affiliate_products(category_id);
CREATE INDEX idx_affiliate_products_updated ON affiliate_products(updated_at DESC);
CREATE INDEX idx_affiliate_products_hidden_gem ON affiliate_products(is_hidden_gem)
  WHERE is_hidden_gem = TRUE; -- Partial index for gems only

CREATE INDEX idx_metric_history_product ON affiliate_metric_history(product_id, recorded_at DESC);
CREATE INDEX idx_metric_history_type ON affiliate_metric_history(metric_type, recorded_at DESC);

-- Full-text search index (for title/description search)
CREATE INDEX idx_affiliate_products_search ON affiliate_products
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE affiliate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_metric_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_categories ENABLE ROW LEVEL SECURITY;

-- Public Read Access (anonymous users can SELECT)
CREATE POLICY "Public read access on products"
  ON affiliate_products FOR SELECT
  USING (true);

CREATE POLICY "Public read access on history"
  ON affiliate_metric_history FOR SELECT
  USING (true);

CREATE POLICY "Public read access on categories"
  ON affiliate_categories FOR SELECT
  USING (true);

-- Service Role Write Access (ingestion/scoring services)
-- Note: service_role bypasses RLS by default, but we define policies for clarity
CREATE POLICY "Service role can insert products"
  ON affiliate_products FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can update products"
  ON affiliate_products FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can delete products"
  ON affiliate_products FOR DELETE
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage history"
  ON affiliate_metric_history FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- SEED DATA: Categories (Top 12 Profitable Niches)
-- ============================================================================
INSERT INTO affiliate_categories (name, slug) VALUES
  ('Health & Fitness', 'health-fitness'),
  ('Wealth & Finance', 'wealth-finance'),
  ('Relationships & Dating', 'relationships-dating'),
  ('Technology & Software', 'technology-software'),
  ('Business & Marketing', 'business-marketing'),
  ('Self-Improvement', 'self-improvement'),
  ('Survival & Preparedness', 'survival-preparedness'),
  ('Hobbies & Crafts', 'hobbies-crafts'),
  ('Education & Learning', 'education-learning'),
  ('Home & Garden', 'home-garden'),
  ('Travel & Lifestyle', 'travel-lifestyle'),
  ('Entertainment & Gaming', 'entertainment-gaming')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_affiliate_products_updated_at
  BEFORE UPDATE ON affiliate_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. After running this migration, execute 002_api_security.sql for views/RPCs
-- 2. Generate TypeScript types: npx supabase gen types typescript --project-id <id>
-- 3. Initial data ingestion: npx ts-node scripts/manual-ingest.ts
-- 4. Calculate scores: npx ts-node scripts/manual-score.ts
