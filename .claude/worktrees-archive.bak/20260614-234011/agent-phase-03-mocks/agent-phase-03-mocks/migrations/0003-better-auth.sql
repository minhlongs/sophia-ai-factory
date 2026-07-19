-- Better Auth Migration — Sophia AI Factory
-- Adds Better Auth core tables alongside existing D1 schema.
-- Existing tables (users, organizations, org_members, etc.) are preserved.

-- ── Better Auth Core Tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  emailVerified INTEGER DEFAULT 0,
  name TEXT,
  image TEXT,
  role TEXT DEFAULT 'user',
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "session" (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  expiresAt TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "account" (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  expiresAt TEXT,
  password TEXT,
  scope TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now')),
  UNIQUE(providerId, accountId)
);

CREATE TABLE IF NOT EXISTS "verification" (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ba_session_userId ON "session"(userId);
CREATE INDEX IF NOT EXISTS idx_ba_session_token ON "session"(token);
CREATE INDEX IF NOT EXISTS idx_ba_account_userId ON "account"(userId);
CREATE INDEX IF NOT EXISTS idx_ba_user_email ON "user"(email);

-- ── Data Migration: existing users → Better Auth user table ─────────────────

INSERT OR IGNORE INTO "user" (id, email, emailVerified, name, image, role, createdAt, updatedAt)
SELECT id, email, email_verified, full_name, avatar_url, COALESCE(role, 'user'), created_at, updated_at
FROM users;

-- Create credential accounts for users with passwords (preserves PBKDF2 hashes)
INSERT OR IGNORE INTO "account" (id, userId, accountId, providerId, password, createdAt, updatedAt)
SELECT lower(hex(randomblob(16))), id, id, 'credential', password_hash, created_at, updated_at
FROM users
WHERE password_hash IS NOT NULL;
