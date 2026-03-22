-- Migration 0002: Add sales command templates for RaaS
-- Date: 2026-03-22

INSERT OR IGNORE INTO mission_templates (command, title, description, mcu_cost, is_active)
VALUES
  ('sales:proposal-deck', 'Proposal Deck', 'Generate a full proposal deck with structured slides for client pitches', 10, 1),
  ('sales:roi-calculator', 'ROI Calculator', 'Calculate ROI projections for prospects based on their current workflow', 5, 1),
  ('sales:competitor-analysis', 'Competitor Analysis', 'Deep SWOT analysis against competitors with win strategies', 8, 1),
  ('sales:pricing-optimizer', 'Pricing Optimizer', 'Recommend optimal pricing tier based on usage patterns and segment', 3, 1),
  ('sales:outreach-sequence', 'Outreach Sequence', 'Generate multi-step email + LinkedIn outreach sequence for prospects', 8, 1);
