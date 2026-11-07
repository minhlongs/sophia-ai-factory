-- Migration 0496: remove the legacy `users` FK from platform_configs.
--
-- Migration 0439 retires `users` after moving auth to Better Auth's singular
-- `user` table. A retained `REFERENCES users(id)` makes every platform config
-- write fail with "no such table: main.users", including the durable affiliate
-- kill switch.
--
-- The columns below match what production actually holds (verified by reading
-- the live D1 schema on 2026-11-06): `updated_by` is NOT NULL and `updated_at`
-- is a TEXT timestamp. `platform-config-repo` binds the authenticated user id
-- on every write, so the constraint holds; keeping the column nullable would
-- silently widen the contract the application never uses.
--
-- Safe to re-run: the staging table and index are dropped or created with guards.

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS platform_configs_new;

CREATE TABLE platform_configs_new (
  key TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO platform_configs_new (key, encrypted_value, updated_by, updated_at)
SELECT key, encrypted_value, updated_by, updated_at FROM platform_configs;

DROP TABLE platform_configs;
ALTER TABLE platform_configs_new RENAME TO platform_configs;

CREATE INDEX IF NOT EXISTS idx_platform_configs_updated ON platform_configs(updated_at);

PRAGMA foreign_keys = ON;
