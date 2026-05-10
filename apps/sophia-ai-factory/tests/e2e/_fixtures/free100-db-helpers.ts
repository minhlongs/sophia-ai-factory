/**
 * free100-db-helpers.ts — Local D1 SQLite open + schema bootstrap helpers.
 *
 * Internal helpers used by free100-fixtures.ts.
 * Not exported from the fixtures index — import free100-fixtures.ts instead.
 *
 * Local D1 path strategy:
 *   Miniflare stores D1 in .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite
 *   We locate the non-metadata sqlite file at runtime.
 *
 * Schema bootstrap:
 *   Local D1 only has migrations 0001-0034 applied (last run: 2026-05-03).
 *   Migrations 0035-0100 are NOT applied. We CREATE TABLE IF NOT EXISTS
 *   the tables needed by E2E tests inline so tests don't require a full
 *   migration run against the local D1.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ── Local D1 resolution ──────────────────────────────────────────────────────

export function getLocalD1Path(): string {
  const base = path.resolve(
    __dirname,
    '../../../.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
  );
  if (!fs.existsSync(base)) {
    throw new Error(
      `[free100-db-helpers] Local D1 directory not found at ${base}. ` +
      'Run `npm run dev` once to initialize the local D1.',
    );
  }
  const files = fs
    .readdirSync(base)
    .filter((f) => f.endsWith('.sqlite') && !f.includes('metadata'))
    .map((f) => path.join(base, f));

  if (files.length === 0) {
    throw new Error(
      `[free100-db-helpers] No D1 SQLite file found in ${base}. ` +
      'Run `npm run dev` once to initialize the local D1.',
    );
  }
  return files[0];
}

export function openDb(): Database.Database {
  const db = new Database(getLocalD1Path());
  // Disable FK enforcement for test seeding — local D1 has FKs between
  // legacy "users" table and newer "user" (Better Auth) table which diverge.
  // FK is OFF by default in SQLite/D1 but better-sqlite3 may enable it.
  db.pragma('foreign_keys = OFF');
  return db;
}

// ── Schema bootstrap (inline CREATE TABLE IF NOT EXISTS) ─────────────────────

/**
 * Ensure tables needed by FREE100 E2E tests exist in local D1.
 * Creates tables that are only present after migrations 0035-0100.
 * Safe to call on every fixture invocation — IF NOT EXISTS guards against duplication.
 */
export function ensureTablesExist(db: Database.Database): void {
  // telegram_paired_chats (migration 0077 + 0100 UNIQUE constraint on paired_by)
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_paired_chats (
      chat_id  TEXT PRIMARY KEY,
      first_name TEXT,
      paired_at  TEXT NOT NULL DEFAULT (datetime('now')),
      paired_by  TEXT NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS idx_telegram_paired_by
      ON telegram_paired_chats(paired_by);
  `);

  // engine_missions (migration 0052)
  db.exec(`
    CREATE TABLE IF NOT EXISTS engine_missions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      command TEXT NOT NULL DEFAULT 'video.generate',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','running','succeeded','failed','cancelled')),
      result TEXT,
      error TEXT,
      credits_used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_engine_missions_user
      ON engine_missions(user_id, created_at DESC);
  `);

  // publishing_channels (migration 0083, CHECK loosened for test flexibility)
  db.exec(`
    CREATE TABLE IF NOT EXISTS publishing_channels (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_account_id TEXT NOT NULL,
      display_name TEXT,
      access_token TEXT NOT NULL DEFAULT '',
      refresh_token TEXT,
      expires_at INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      refreshing_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(tenant_id, provider, external_account_id)
    );
  `);

  // publishing_jobs (migration 20260503_publishing + 0099 provider + 0101 video_id rename)
  db.exec(`
    CREATE TABLE IF NOT EXISTS publishing_jobs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      caption TEXT,
      hashtags_json TEXT,
      product_link TEXT,
      scheduled_at INTEGER NOT NULL DEFAULT (unixepoch()),
      started_at INTEGER,
      finished_at INTEGER,
      retry_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      provider TEXT NOT NULL DEFAULT ''
    );
  `);
}
