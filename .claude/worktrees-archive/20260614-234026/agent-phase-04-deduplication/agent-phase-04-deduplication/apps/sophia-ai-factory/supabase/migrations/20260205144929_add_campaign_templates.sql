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
