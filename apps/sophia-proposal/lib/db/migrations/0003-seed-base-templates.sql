-- Migration 0003: Seed 10 base command templates
-- Idempotent via INSERT OR IGNORE

INSERT OR IGNORE INTO mission_templates (command, title, description, mcu_cost, is_active) VALUES
  ('proposal:create',    'Create Proposal',    'AI-powered proposal generation',          5,  1),
  ('video:create',       'Create Video',       'AI video production with HeyGen',         8,  1),
  ('affiliate:generate', 'Generate Affiliates','Find affiliate opportunities',             3,  1),
  ('affiliate:scrape',   'Scrape Affiliates',  'Scrape affiliate data from sources',      3,  1),
  ('content:blog',       'Blog Post',          'Generate SEO-optimized blog content',     5,  1),
  ('content:social',     'Social Media',       'Create social media content pack',        3,  1),
  ('crm:sync',           'CRM Sync',           'Sync data with HubSpot CRM',              2,  1),
  ('analytics:export',   'Analytics Export',   'Export usage analytics report',           2,  1),
  ('gtm:campaign',       'GTM Campaign',       'Orchestrate go-to-market campaign',       15, 1),
  ('sales:battlecard',   'Sales Battlecard',   'Generate competitive battlecard',         5,  1);
