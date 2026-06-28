-- Seed data for Sophia AI Factory
-- This file is applied when running `supabase db reset` or `supabase start`

-- 1. Create a test user profile (if not exists)
-- Note: Authentication users are handled by Gotrue/Auth service,
-- but we can verify the public profile table triggers work.

-- 2. Ensure Campaign Templates are populated (Redundant if migration 20260205144929 runs, but good for idempotency)
INSERT INTO campaign_templates (id, name, description, category, icon, defaults, is_predefined) VALUES
(
  'welcome',
  'Welcome Campaign',
  'Onboard new subscribers with a warm introduction to your brand',
  'welcome',
  '👋',
  '{"title": "Welcome to [Your Brand]", "audience": "New subscribers and customers", "tone": "friendly", "suggestedDuration": 20, "keywords": ["welcome", "introduction", "getting started", "onboarding"]}'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;

-- 3. Mock Data for Campaigns (Optional - for local dev only)
-- INSERT INTO campaigns (id, user_id, title, status, created_at) ...
