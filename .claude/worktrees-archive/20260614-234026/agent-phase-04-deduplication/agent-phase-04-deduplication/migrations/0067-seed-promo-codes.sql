-- Migration 0067: Seed promo codes for launch
-- FREE50: 50% off any tier (100 uses, 90-day window)
-- FREETRIAL30: 30-day free trial BASIC (50 uses, 60-day window)
-- FREESTARTER: Free STARTER_BUNDLE one-time (20 uses, 30-day window)

INSERT OR IGNORE INTO promo_codes (code, description, discount_type, discount_value, applies_to_tier, applies_to_sku, max_uses, max_uses_per_user, valid_until, status)
VALUES
  ('FREE50',
   '50% off first month — Launch promo',
   'percent_off', 50, NULL, NULL, 100, 1,
   unixepoch() + 90*86400, 'active'),
  ('FREETRIAL30',
   '30-day free trial of BASIC tier',
   'free_trial', 30, 'BASIC', NULL, 50, 1,
   unixepoch() + 60*86400, 'active'),
  ('FREESTARTER',
   'Free STARTER_BUNDLE for first 20 customers',
   'free_full', 0, NULL, 'STARTER_BUNDLE', 20, 1,
   unixepoch() + 30*86400, 'active');
