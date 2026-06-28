/**
 * free100-fixtures.ts — DB seed/teardown helpers for FREE100 E2E tests.
 *
 * Uses better-sqlite3 to write directly into the local D1 SQLite file.
 * Local D1 path resolution + schema bootstrap: see free100-db-helpers.ts.
 *
 * All seeds are idempotent (INSERT OR REPLACE / INSERT OR IGNORE).
 * tearDown deletes all rows seeded for a test user (by userId).
 *
 * IMPORTANT: Only writes to LOCAL D1. Never touches remote D1.
 *
 * Auth cookie strategy:
 *   Better Auth in dev mode uses cookie name: "better-auth.session_token"
 *   (no __Secure- prefix because useSecureCookies = false in development).
 *   However, Better Auth validates the session token against its signing secret
 *   on each request. Direct SQLite insertion works for reading data but
 *   the session token returned by seedTestUser() will be REJECTED by the
 *   server unless BETTER_AUTH_SECRET matches the seeded token's signature.
 *
 *   TODO: To fully unblock auth-dependent tests, either:
 *   (a) Use Better Auth's admin API to issue a properly-signed session
 *   (b) Add NEXT_PUBLIC_MOCK_AUTH=true env flag that bypasses validation
 */

import { openDb, ensureTablesExist } from './free100-db-helpers';

// ── Seed helpers ──────────────────────────────────────────────────────────────

export interface SeedUserOptions {
  email: string;
  /** Tier stored in subscriptions.tier column */
  tier?: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
}

export interface SeededUser {
  userId: string;
  sessionToken: string;
  /** Cookie value to inject: "better-auth.session_token=<token>" */
  cookieValue: string;
}

/**
 * Seed a test user + Better Auth session for cookie injection.
 * Returns the session token — note: server validation requires signed token.
 */
export function seedTestUser(opts: SeedUserOptions): SeededUser {
  const db = openDb();
  ensureTablesExist(db);

  const userId = `e2e-${Buffer.from(opts.email).toString('hex').slice(0, 24)}`;
  const sessionId = `sess-${userId}`;
  const sessionToken = `e2e-token-${userId}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const tier = opts.tier ?? 'MASTER';

  // Insert or replace user in Better Auth "user" table
  db.prepare(`
    INSERT OR REPLACE INTO "user" (id, email, emailVerified, name, createdAt, updatedAt)
    VALUES (?, ?, 1, ?, ?, ?)
  `).run(userId, opts.email, `E2E ${opts.email}`, now, now);

  // Insert or replace session
  db.prepare(`
    INSERT OR REPLACE INTO "session" (id, userId, token, expiresAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, userId, sessionToken, expiresAt, now, now);

  // Ensure org + subscription exist (Better Auth databaseHook does this in prod,
  // but the hook doesn't fire for direct DB writes — seed manually here)
  const orgId = `org-${userId}`;
  db.prepare(`
    INSERT OR IGNORE INTO organizations (id, name, slug, plan, settings, created_at, updated_at)
    VALUES (?, ?, ?, 'free', '{}', ?, ?)
  `).run(orgId, opts.email, `e2e-${userId.slice(0, 8)}`, now, now);

  db.prepare(`
    INSERT OR IGNORE INTO org_members (id, org_id, user_id, role, created_at)
    VALUES (?, ?, ?, 'owner', ?)
  `).run(`om-${userId}`, orgId, userId, now);

  // subscriptions row so getUserTier() resolves correctly.
  // Migration 0086 adds user_id + tier columns — only insert if present (local D1 may be behind).
  const subCols = (db.prepare(`PRAGMA table_info(subscriptions)`).all() as Array<{ name: string }>)
    .map((c) => c.name);
  if (subCols.includes('user_id') && subCols.includes('tier')) {
    db.prepare(`
      INSERT OR REPLACE INTO subscriptions (id, org_id, user_id, plan, tier, status, created_at, updated_at)
      VALUES (?, ?, ?, 'basic', ?, 'active', ?, ?)
    `).run(`sub-${userId}`, orgId, userId, tier, now, now);
  } else {
    // Fallback: insert minimal subscription row without user_id/tier
    db.prepare(`
      INSERT OR IGNORE INTO subscriptions (id, org_id, plan, status, created_at, updated_at)
      VALUES (?, ?, 'basic', 'active', ?, ?)
    `).run(`sub-${userId}`, orgId, now, now);
  }

  db.close();

  return {
    userId,
    sessionToken,
    cookieValue: `better-auth.session_token=${sessionToken}`,
  };
}

export interface SeedVideoOptions {
  userId: string;
  r2Key?: string;
}

export interface SeededVideo {
  videoId: string;
}

/**
 * Seed a completed video row in local D1.
 * provider='ai-prompt', status='completed', r2_key set.
 */
export function seedCompletedVideo(opts: SeedVideoOptions): SeededVideo {
  const db = openDb();
  ensureTablesExist(db);

  const videoId = `e2e-vid-${opts.userId.slice(0, 16)}`;
  const r2Key = opts.r2Key ?? `e2e-videos/${videoId}/output.mp4`;
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT OR REPLACE INTO videos (
      id, user_id, status, provider, r2_key, title, created_at, updated_at
    ) VALUES (?, ?, 'completed', 'ai-prompt', ?, 'E2E Test Video', ?, datetime('now'))
  `).run(videoId, opts.userId, r2Key, now);

  db.close();
  return { videoId };
}

export interface SeedTelegramOptions {
  userId: string;
  chatId?: string;
}

export interface SeededTelegram {
  chatId: string;
}

/**
 * Seed telegram_paired_chats for a user.
 * Uses INSERT OR REPLACE for UNIQUE(paired_by) per migration 0100.
 */
export function seedTelegramPairing(opts: SeedTelegramOptions): SeededTelegram {
  const db = openDb();
  ensureTablesExist(db);

  const chatId = opts.chatId ?? `chat-${opts.userId.slice(0, 16)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO telegram_paired_chats (chat_id, first_name, paired_at, paired_by)
    VALUES (?, 'E2E Test', ?, ?)
  `).run(chatId, now, opts.userId);

  db.close();
  return { chatId };
}

/**
 * Delete all seeded rows for a test user (cascade cleanup).
 * Call in afterEach / afterAll to keep local D1 clean.
 */
export function tearDown(userId: string): void {
  const db = openDb();

  db.prepare(`DELETE FROM "session" WHERE userId = ?`).run(userId);
  db.prepare(`DELETE FROM "user" WHERE id = ?`).run(userId);
  db.prepare(`DELETE FROM videos WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM telegram_paired_chats WHERE paired_by = ?`).run(userId);
  // subscriptions: only delete by user_id if that column exists
  const subCols = (db.prepare(`PRAGMA table_info(subscriptions)`).all() as Array<{ name: string }>)
    .map((c) => c.name);
  if (subCols.includes('user_id')) {
    db.prepare(`DELETE FROM subscriptions WHERE user_id = ?`).run(userId);
  } else {
    db.prepare(`DELETE FROM subscriptions WHERE id = ?`).run(`sub-${userId}`);
  }

  const orgId = `org-${userId}`;
  db.prepare(`DELETE FROM org_members WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM organizations WHERE id = ?`).run(orgId);

  db.close();
}
