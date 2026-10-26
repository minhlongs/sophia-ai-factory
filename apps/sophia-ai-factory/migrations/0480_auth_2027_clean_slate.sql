-- Migration 0480: Auth 2027 Clean Slate Schema
--
-- 1. Adds `twoFactorEnabled` column to `user` table for Better Auth twoFactor plugin.
-- 2. Creates `passkey` table for @better-auth/passkey (WebAuthn FaceID/TouchID/YubiKey).
-- 3. Creates `twoFactor` table for Better Auth TOTP + backup codes.
-- 4. Rebuilds `campaigns`, `tier_change_events`, and `raas_licenses` without legacy
--    `REFERENCES users(id)` hard foreign key traps so Better Auth `user.id` inserts succeed.

PRAGMA foreign_keys = OFF;

-- ── 1. Better Auth Two-Factor User Column ───────────────────────────────────
ALTER TABLE "user" ADD COLUMN twoFactorEnabled INTEGER DEFAULT 0;

-- ── 2. Better Auth Passkey (WebAuthn) Table ─────────────────────────────────
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

-- ── 3. Better Auth Two-Factor (TOTP) Table ──────────────────────────────────
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

-- ── 4. Rebuild `campaigns` without legacy `REFERENCES users(id)` FK ─────────
DROP TRIGGER IF EXISTS trg_campaigns_set_org_id;
DROP TRIGGER IF EXISTS trg_campaigns_reject_null_org_update;
DROP TRIGGER IF EXISTS trg_campaigns_assert_org_after_insert;

CREATE TABLE campaigns_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  topic TEXT,
  audience TEXT,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','queued','processing_script','processing_video','completed','failed','video_timeout')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  template_id TEXT,
  script_content TEXT,
  audio_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  org_id TEXT
);

INSERT INTO campaigns_new (
  id, user_id, title, topic, audience, status, progress, template_id,
  script_content, audio_url, video_url, thumbnail_url, error_message,
  created_at, updated_at, org_id
)
SELECT
  id, user_id, title, topic, audience, status, progress, template_id,
  script_content, audio_url, video_url, thumbnail_url, error_message,
  created_at, updated_at, org_id
FROM campaigns;

DROP TABLE campaigns;
ALTER TABLE campaigns_new RENAME TO campaigns;

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_created ON campaigns(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_user ON campaigns(org_id, user_id);

CREATE TRIGGER trg_campaigns_set_org_id AFTER INSERT ON campaigns WHEN NEW.org_id IS NULL BEGIN
  UPDATE campaigns
  SET org_id = (
    SELECT om.org_id
    FROM org_members om
    WHERE om.user_id = NEW.user_id
    ORDER BY om.created_at ASC
    LIMIT 1
  )
  WHERE id = NEW.id;
END;

CREATE TRIGGER trg_campaigns_reject_null_org_update BEFORE UPDATE OF org_id ON campaigns WHEN NEW.org_id IS NULL BEGIN
  SELECT RAISE(ABORT, 'campaigns.org_id cannot be NULL');
END;

CREATE TRIGGER trg_campaigns_assert_org_after_insert AFTER INSERT ON campaigns WHEN (SELECT org_id FROM campaigns WHERE id = NEW.id) IS NULL BEGIN
  SELECT RAISE(ABORT, 'campaigns.org_id failed to auto-populate (user has no org_members row)');
END;

-- ── 5. Rebuild `tier_change_events` without legacy `REFERENCES users(id)` ───
CREATE TABLE tier_change_events_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  org_id TEXT,
  from_tier TEXT,
  to_tier TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('upgrade', 'downgrade', 'cancel', 'activate')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO tier_change_events_new (id, user_id, org_id, from_tier, to_tier, event_type, created_at)
SELECT id, user_id, org_id, from_tier, to_tier, event_type, created_at
FROM tier_change_events;

DROP TABLE tier_change_events;
ALTER TABLE tier_change_events_new RENAME TO tier_change_events;

CREATE INDEX IF NOT EXISTS idx_tce_user_id ON tier_change_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tce_created_at ON tier_change_events(created_at);
CREATE INDEX IF NOT EXISTS idx_tce_event_type ON tier_change_events(event_type);

-- ── 6. Rebuild `raas_licenses` without legacy `REFERENCES users(id)` ────────
CREATE TABLE raas_licenses_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  key_hash TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('BASIC','PREMIUM','ENTERPRISE','MASTER')),
  expires_at INTEGER,
  nonce TEXT NOT NULL UNIQUE,
  is_revoked INTEGER DEFAULT 0,
  revoked_at INTEGER,
  revoked_by TEXT,
  created_by TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  metadata TEXT DEFAULT '{}',
  updated_at INTEGER,
  polar_customer_id TEXT,
  stripe_customer_id TEXT
);

INSERT INTO raas_licenses_new (
  id, key_hash, tier, expires_at, nonce, is_revoked, revoked_at,
  revoked_by, created_by, user_id, created_at, metadata, updated_at,
  polar_customer_id, stripe_customer_id
)
SELECT
  id, key_hash, tier, expires_at, nonce, is_revoked, revoked_at,
  revoked_by, created_by, user_id, created_at, metadata, updated_at,
  polar_customer_id, stripe_customer_id
FROM raas_licenses;

DROP TABLE raas_licenses;
ALTER TABLE raas_licenses_new RENAME TO raas_licenses;

CREATE INDEX IF NOT EXISTS idx_raas_licenses_key_hash ON raas_licenses(key_hash);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_nonce ON raas_licenses(nonce);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_tier ON raas_licenses(tier);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_user_id ON raas_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_created_by ON raas_licenses(created_by);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_active ON raas_licenses(is_revoked, expires_at) WHERE is_revoked = 0;
CREATE INDEX IF NOT EXISTS idx_raas_licenses_user_created ON raas_licenses(user_id, created_at DESC);

PRAGMA foreign_keys = ON;
