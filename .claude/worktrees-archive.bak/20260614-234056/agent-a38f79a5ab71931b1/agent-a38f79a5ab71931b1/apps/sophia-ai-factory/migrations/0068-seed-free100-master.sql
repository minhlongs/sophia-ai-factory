-- Promo code FREE100: 100% off MASTER tier (lifetime access)
-- CEO directive: gift codes for premium beta partners / strategic referrals
-- Conservative limits since MASTER = $4999 lifetime value
INSERT OR IGNORE INTO promo_codes (
  code,
  description,
  discount_type,
  discount_value,
  applies_to_tier,
  applies_to_sku,
  max_uses,
  used_count,
  max_uses_per_user,
  valid_from,
  valid_until,
  status,
  created_at,
  metadata
) VALUES (
  'FREE100',
  '100% off MASTER tier — full lifetime access for VIP partners',
  'free_full',
  0,
  'MASTER',
  NULL,
  10,
  0,
  1,
  unixepoch(),
  unixepoch() + 90 * 86400,
  'active',
  unixepoch(),
  '{"campaign":"vip_partner","tier_target":"MASTER","value_usd":4999}'
);
