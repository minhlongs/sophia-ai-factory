-- Migration 0098: Backfill onboarding_completed_at for existing MASTER users
-- Prevents existing MASTER users from being unexpectedly redirected to the new
-- onboarding flow after Wave 16 deploy.
--
-- The "user" table (migration 0003-better-auth.sql) stores "createdAt" as TEXT
-- (ISO 8601, camelCase). onboarding_completed_at is INTEGER unix-ms.
-- julianday() parses ISO TEXT → Julian Day Number → convert to unix-ms INTEGER.
--
-- Edge case: if the user record is missing (deleted), COALESCE falls back to
-- current timestamp so the profile is never left NULL (which would cause an
-- onboarding redirect loop).
--
-- Scope: ALL existing MASTER-tier users where onboarding_completed_at IS NULL.
-- Safe to run multiple times (WHERE clause prevents double-update).

UPDATE user_profiles
SET onboarding_completed_at = COALESCE(
  (
    SELECT CAST((julianday(u."createdAt") - 2440587.5) * 86400000 AS INTEGER)
    FROM "user" u
    WHERE u.id = user_profiles.user_id
    LIMIT 1
  ),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
)
WHERE onboarding_completed_at IS NULL
  AND subscription_tier = 'MASTER';
