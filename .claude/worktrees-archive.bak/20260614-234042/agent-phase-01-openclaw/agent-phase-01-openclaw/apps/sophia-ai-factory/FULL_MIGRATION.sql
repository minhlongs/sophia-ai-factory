-- ============================================================================
-- DEPRECATED: 2026-04-30
-- This is HISTORICAL Supabase schema from Feb 2026.
-- Production database is Cloudflare D1.
-- DO NOT EXECUTE AGAINST D1 — use migrations/ directory for current schema.
-- See: apps/sophia-ai-factory/migrations/ (0001–0034)
-- ============================================================================
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
-- Enable RLS (already enabled in 001, but refining policies)

-- Policy: Public can see basic info (Title, Score, etc.)
-- But cannot see affiliate_link unless they are authenticated (or specific role)
-- For MVP: We might just rely on the API layer to filter fields if we don't want to complicate RLS too much yet.
-- However, "Deep Defense" suggests RLS.

-- Let's create a secure view or use column-level security if Postgres supports it nicely,
-- or just policies. Postgres doesn't natively support "Column Level RLS" easily for SELECT (it hides rows, not columns).
-- Common pattern: separate sensitive data into a separate table or 1-to-1 table, OR use a View.

-- Approach: Create a VIEW for public discovery that excludes affiliate_link.
CREATE OR REPLACE VIEW public_affiliate_products AS
SELECT
  id,
  title,
  description,
  thumbnail_url,
  price_usd,
  commission_rate,
  avg_earnings_usd,
  sps_score,
  is_hidden_gem,
  category_id,
  created_at,
  updated_at
  -- Excludes: affiliate_link, external_id, raw_metrics (maybe too detailed?)
FROM affiliate_products;

-- Grant access to this view
GRANT SELECT ON public_affiliate_products TO anon, authenticated;

-- RPC Function for efficient Top 50 fetching with filtering
-- This allows us to encapsulate logic and potentially cache at DB level if needed later.
CREATE OR REPLACE FUNCTION get_top_products(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_category_id INTEGER DEFAULT NULL,
  p_min_sps DECIMAL DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  sps_score DECIMAL,
  avg_earnings_usd DECIMAL,
  is_hidden_gem BOOLEAN,
  category_id INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner permissions (bypass RLS if needed, or ensuring consistent view)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.description,
    p.thumbnail_url,
    p.sps_score,
    p.avg_earnings_usd,
    p.is_hidden_gem,
    p.category_id
  FROM affiliate_products p
  WHERE
    (p_category_id IS NULL OR p.category_id = p_category_id)
    AND (p_min_sps IS NULL OR p.sps_score >= p_min_sps)
  ORDER BY p.sps_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
-- User-specific integration storage (ClickBank, ShareASale keys)
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- Links to auth.users
  network_id TEXT NOT NULL CHECK (network_id IN ('clickbank', 'shareasale', 'amazon')),
  api_key TEXT NOT NULL, -- Encrypted at rest
  api_secret TEXT, -- For OAuth networks like ShareASale
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, network_id)
);

-- RLS: Users can only see their own integrations
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
  ON user_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON user_integrations FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to get user's active integration credentials
CREATE OR REPLACE FUNCTION get_user_integration(p_network TEXT)
RETURNS TABLE (api_key TEXT, api_secret TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ui.api_key, ui.api_secret
  FROM user_integrations ui
  WHERE ui.user_id = auth.uid()
    AND ui.network_id = p_network
    AND ui.is_active = TRUE
  LIMIT 1;
END;
$$;
-- User profiles for linking external accounts (Telegram) and storing settings
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT UNIQUE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Insert profile trigger on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- Add subscription tier tracking to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;

-- Index for querying by tier
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(subscription_tier);
-- Drop the existing check constraint
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_check;

-- Add updated check constraint with new tier values
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_subscription_tier_check
CHECK (subscription_tier IN ('free', 'basic', 'premium', 'pro', 'enterprise'));

-- Comment on column to clarify values
COMMENT ON COLUMN user_profiles.subscription_tier IS 'Subscription tier: free, basic, premium, pro (legacy), enterprise';
-- Add subscription expiration tracking for monthly maintenance billing
-- Migration: 007_add_subscription_expiration.sql

-- Add expiration column for subscription checking
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;

-- Update tier constraint to include 'basic' 
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_check;

ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'basic', 'pro', 'premium', 'enterprise'));

-- Index for querying expired subscriptions (for cron cleanup)
CREATE INDEX IF NOT EXISTS idx_user_profiles_expires 
ON user_profiles(subscription_expires_at) 
WHERE subscription_expires_at IS NOT NULL;

-- Function to auto-downgrade expired subscriptions (optional cron)
CREATE OR REPLACE FUNCTION downgrade_expired_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET 
    subscription_tier = 'basic',
    subscription_status = 'expired',
    updated_at = NOW()
  WHERE 
    subscription_expires_at IS NOT NULL 
    AND subscription_expires_at < NOW()
    AND subscription_tier != 'basic';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN user_profiles.subscription_expires_at IS 'When subscription expires. NULL = lifetime/one-time purchase';
COMMENT ON COLUMN user_profiles.polar_customer_id IS 'Polar customer ID for subscription portal access';
-- Create campaign_status enum
create type campaign_status as enum (
  'draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'
);

-- Create campaigns table
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  title text not null,
  topic text,
  audience text,

  -- State & Progress
  status campaign_status default 'draft'::campaign_status,
  progress integer default 0, -- 0 to 100
  error_message text,

  -- Assets (JSONB for flexibility)
  script_content jsonb, -- { "scenes": [...] }
  video_url text,
  thumbnail_url text,

  -- Meta
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for dashboard queries
create index idx_campaigns_user on campaigns(user_id);

-- Enable RLS
alter table campaigns enable row level security;

-- Policies
create policy "Users can view their own campaigns"
  on campaigns for select
  using (auth.uid() = user_id);

create policy "Users can create their own campaigns"
  on campaigns for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own campaigns"
  on campaigns for update
  using (auth.uid() = user_id);

-- Add trigger for updated_at
create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on campaigns
  for each row execute procedure moddatetime (updated_at);

-- Add to realtime publication
alter publication supabase_realtime add table campaigns;
-- Migration: Add template_id to campaigns table and create campaign_templates table
-- Created: 2026-02-05

-- Step 1: Add template_id column to campaigns table
ALTER TABLE campaigns
ADD COLUMN template_id TEXT;

-- Step 2: Create campaign_templates table (for future custom templates)
CREATE TABLE IF NOT EXISTS campaign_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT DEFAULT '📝',
  defaults JSONB NOT NULL,
  is_predefined BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Add RLS policies for campaign_templates
ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;

-- Allow reading predefined templates (is_predefined = true)
CREATE POLICY "Allow reading predefined templates"
  ON campaign_templates
  FOR SELECT
  USING (is_predefined = true);

-- Allow users to read their own custom templates
CREATE POLICY "Allow reading own custom templates"
  ON campaign_templates
  FOR SELECT
  USING (user_id = auth.uid());

-- Allow users to create custom templates
CREATE POLICY "Allow creating custom templates"
  ON campaign_templates
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow users to update their own custom templates
CREATE POLICY "Allow updating own custom templates"
  ON campaign_templates
  FOR UPDATE
  USING (user_id = auth.uid());

-- Allow users to delete their own custom templates
CREATE POLICY "Allow deleting own custom templates"
  ON campaign_templates
  FOR DELETE
  USING (user_id = auth.uid());

-- Step 4: Seed predefined templates
INSERT INTO campaign_templates (id, name, description, category, icon, defaults, is_predefined) VALUES
(
  'welcome',
  'Welcome Campaign',
  'Onboard new subscribers with a warm introduction to your brand',
  'welcome',
  '👋',
  '{"title": "Welcome to [Your Brand]", "audience": "New subscribers and customers", "tone": "friendly", "suggestedDuration": 20, "keywords": ["welcome", "introduction", "getting started", "onboarding"]}'::jsonb,
  true
),
(
  'product-launch',
  'Product Launch',
  'Announce and showcase your new product with excitement',
  'product',
  '🚀',
  '{"title": "Introducing [Product Name]", "audience": "Existing customers and product enthusiasts", "tone": "enthusiastic", "suggestedDuration": 25, "keywords": ["new product", "launch", "innovation", "features"]}'::jsonb,
  true
),
(
  'seasonal',
  'Seasonal Campaign',
  'Leverage seasonal events and holidays for timely content',
  'seasonal',
  '🎉',
  '{"title": "Special [Season/Holiday] Offer", "audience": "All customers", "tone": "enthusiastic", "suggestedDuration": 20, "keywords": ["seasonal", "limited time", "holiday", "celebration"]}'::jsonb,
  true
),
(
  'flash-sale',
  'Flash Sale',
  'Create urgency with time-sensitive promotional offers',
  'promotion',
  '⚡',
  '{"title": "Flash Sale: [Discount]% Off!", "audience": "Active customers and deal seekers", "tone": "urgent", "suggestedDuration": 15, "keywords": ["flash sale", "limited time", "urgent", "discount"]}'::jsonb,
  true
),
(
  'viral-content',
  'Viral Content',
  'Craft shareable content designed for maximum engagement',
  'viral',
  '🔥',
  '{"title": "You Won''t Believe This!", "audience": "Social media followers and viral content consumers", "tone": "casual", "suggestedDuration": 15, "keywords": ["viral", "trending", "must-see", "share-worthy"]}'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Step 5: Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_category ON campaign_templates(category);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_user_id ON campaign_templates(user_id);

-- Step 6: Add comment
COMMENT ON COLUMN campaigns.template_id IS 'Reference to the campaign template used for creation';
COMMENT ON TABLE campaign_templates IS 'Stores predefined and custom campaign templates';
-- Migration: Add audio_url to campaigns table for TTS integration
-- Created: 2026-02-05

-- Step 1: Add audio_url column to campaigns table
ALTER TABLE campaigns
ADD COLUMN audio_url TEXT;

-- Step 2: Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_audio_url ON campaigns(audio_url) WHERE audio_url IS NOT NULL;

-- Step 3: Add comment
COMMENT ON COLUMN campaigns.audio_url IS 'URL to generated voiceover audio file (TTS output)';
-- Add api_keys column to user_profiles for storing encrypted keys
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{}'::jsonb;

-- Comment to explain usage
COMMENT ON COLUMN user_profiles.api_keys IS 'Encrypted API keys for external services (OpenAI, etc.)';
