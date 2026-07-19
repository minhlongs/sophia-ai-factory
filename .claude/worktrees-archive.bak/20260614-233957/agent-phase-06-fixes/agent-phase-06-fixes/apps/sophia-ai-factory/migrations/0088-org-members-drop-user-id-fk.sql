-- Migration 0088: Drop org_members.user_id FK (wrong table reference)
--
-- Same bug class as 0087 (subscriptions FK trap):
-- org_members.user_id REFERENCES users(id) — but better-auth creates records in `user` (singular).
-- Every FREE100 redemption that triggers ensureCustomerOrg → INSERT into org_members
-- silently fails with FOREIGN KEY constraint, which propagates:
--   ensureCustomerOrg throws → upsertUserTier throws → triggerAutoHandover catches → silent magicLink:null
--
-- Fix: recreate org_members without the wrong FK. Application ensures user exists before insert;
-- FK was defensive but pointed to legacy `users` table that better-auth doesn't populate.

PRAGMA foreign_keys = OFF;

CREATE TABLE org_members_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(org_id, user_id)
);

INSERT INTO org_members_new (id, org_id, user_id, role, created_at)
SELECT id, org_id, user_id, role, created_at FROM org_members;

DROP TABLE org_members;
ALTER TABLE org_members_new RENAME TO org_members;

CREATE INDEX IF NOT EXISTS org_members_user_id_idx ON org_members(user_id);
CREATE INDEX IF NOT EXISTS org_members_org_id_idx ON org_members(org_id);

PRAGMA foreign_keys = ON;
