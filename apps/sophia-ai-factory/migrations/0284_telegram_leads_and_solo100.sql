-- Migration 0284: SOLO100 promo code configuration
-- Milestone M2 (Requirement R2)
-- Note: telegram_leads table is canonically defined in migration 0283.

-- Seed SOLO100 promo code into promo_codes table
INSERT OR IGNORE INTO promo_codes (
  code, description, discount_type, discount_value,
  applies_to_tier, max_uses, max_uses_per_user, valid_until, status, metadata
) VALUES (
  'SOLO100',
  'Exclusive $100 OFF for Solopreneurs & Early Adopters',
  'fixed_off',
  100,
  'BASIC',
  100,
  1,
  unixepoch() + 365*86400,
  'active',
  '{"campaign":"solopreneur_viral_launch","discount_usd":100}'
);
