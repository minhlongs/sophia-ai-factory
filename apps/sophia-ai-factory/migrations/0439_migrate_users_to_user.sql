-- Migration 0439: Backfill users (plural, legacy Supabase) → "user" (singular, Better Auth)
-- Safe to re-run: table creation and insert are guarded.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  email_verified INTEGER,
  full_name TEXT,
  avatar_url TEXT,
  created_at TEXT,
  updated_at TEXT
);

INSERT OR IGNORE INTO "user" (id, email, emailVerified, name, image, createdAt, updatedAt)
SELECT
  id,
  email,
  COALESCE(email_verified, 0) as emailVerified,
  full_name as name,
  avatar_url as image,
  COALESCE(created_at, datetime('now')) as createdAt,
  COALESCE(updated_at, datetime('now')) as updatedAt
FROM users
WHERE email NOT IN (SELECT email FROM "user" WHERE email IS NOT NULL);

DROP TABLE IF EXISTS users;
