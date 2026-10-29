-- Migration 0484: Better Auth passkey and twoFactor tables.
--
-- Better Auth 1.6.29 registers the passkey and two-factor plugins, and the
-- Settings > Security screen calls both: "Add Passkey" and "Enable 2FA".
-- Neither table existed in production, so both calls failed at the database
-- layer.
--
-- These statements were originally part of 0480, which the deploy pipeline
-- discarded wholesale. Each object is created only if absent, so this file is
-- safe to re-run. It carries no DROP or RENAME at all.
--
-- idx_ba_verification_identifier is this file's to create: 0003 creates the
-- `verification` table it indexes but never creates the index, so no other
-- migration owns it. Keeping it here is why 0480 listed it in the first place.

CREATE TABLE IF NOT EXISTS "passkey" (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT,
  publicKey TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  credentialID TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  deviceType TEXT NOT NULL,
  backedUp INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  aaguid TEXT
);

CREATE INDEX IF NOT EXISTS idx_ba_passkey_userId ON "passkey"(userId);
CREATE INDEX IF NOT EXISTS idx_ba_passkey_credentialID ON "passkey"(credentialID);

CREATE TABLE IF NOT EXISTS "twoFactor" (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  secret TEXT NOT NULL,
  backupCodes TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  verified INTEGER DEFAULT 1,
  failedVerificationCount INTEGER DEFAULT 0,
  lockedUntil TEXT
);

CREATE INDEX IF NOT EXISTS idx_ba_twoFactor_userId ON "twoFactor"(userId);
CREATE INDEX IF NOT EXISTS idx_ba_verification_identifier ON "verification"(identifier);
