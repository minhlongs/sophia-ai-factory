-- Migration 004: Backfill users (plural, legacy Supabase) → "user" (singular, Better Auth)
-- Run AFTER deploying Better Auth migrations (0003+).
-- Safe to re-run: INSERT OR IGNORE skips duplicates.

INSERT OR IGNORE INTO "user" (id, email, email_verified, name, image, created_at, updated_at)
SELECT
  id,
  email,
  COALESCE(email_verified, 0) as email_verified,
  name,
  image,
  COALESCE(created_at, datetime('now')) as created_at,
  COALESCE(updated_at, datetime('now')) as updated_at
FROM users
WHERE email NOT IN (SELECT email FROM "user" WHERE email IS NOT NULL);

-- Drop legacy users table (safe — 0 call sites use .from('users'))
DROP TABLE IF EXISTS users;
