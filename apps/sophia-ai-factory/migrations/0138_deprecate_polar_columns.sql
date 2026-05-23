-- Deprecate Polar columns: NULL out all values.
-- Polar.sh was rejected (2026-03-23). Code refs removed 2026-05-23.
-- Columns left in schema to avoid D1 table rebuild; values NULLed to prevent stale data use.

UPDATE subscriptions SET polar_subscription_id = NULL WHERE polar_subscription_id IS NOT NULL;
UPDATE raas_licenses SET polar_customer_id = NULL WHERE polar_customer_id IS NOT NULL;
