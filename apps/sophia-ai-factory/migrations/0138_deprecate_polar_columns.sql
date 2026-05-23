-- Deprecate Polar columns: NULL out all values.
-- Polar.sh was rejected (2026-03-23). Code refs removed 2026-05-23.
-- Columns left in schema to avoid D1 table rebuild; values NULLed to prevent stale data use.

UPDATE subscriptions SET polar_subscription_id = NULL WHERE polar_subscription_id IS NOT NULL;
-- raas_licenses is Supabase-only (not in D1 schema); no D1 action needed.
