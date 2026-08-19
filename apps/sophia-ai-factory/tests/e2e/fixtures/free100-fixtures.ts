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
import { randomUUID } from 'crypto';

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
  /** Explicit video id. Defaults to `e2e-vid-<userId>` if omitted. */
  videoId?: string;
}

export interface SeededVideo {
  videoId: string;
}

/**
 * Seed a completed video row in local D1.
 * provider='ai-prompt', status='completed', r2_key set.
 *
 * The video row is required by GET /api/v1/distribute/jobs/[videoId]/status,
 * which verifies ownership via `SELECT user_id FROM videos WHERE id = ?`
 * (route.ts:66-73) before returning publishing_jobs.
 */
export function seedCompletedVideo(opts: SeedVideoOptions): SeededVideo {
  const db = openDb();
  ensureTablesExist(db);

  const videoId = opts.videoId ?? `e2e-vid-${opts.userId.slice(0, 16)}`;
  const r2Key = opts.r2Key ?? `e2e-videos/${videoId}/output.mp4`;
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT OR REPLACE INTO videos (
      id, user_id, heygen_job_id, status, provider, r2_key, title, created_at, updated_at
    ) VALUES (?, ?, '', 'completed', 'ai-prompt', ?, 'E2E Test Video', ?, datetime('now'))
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

// ── Creative Economy flywheel seeds (migrations 0233-0243) ────────────────────
// Used by tests/e2e/creative-mission-flywheel.spec.ts to seed the full
// Vision → Create → Distribute → Measure → Learn → Compound loop into local D1.

export interface SeedCreativeMissionOptions {
  userId: string;
  workspaceId: string;
  title: string;
  objective: string;
  audience: string;
  geography: string;
  channels: string[];
  monetizationGoals: string[];
}

export interface SeededCreativeMission {
  missionId: string;
}

/**
 * Seed a creative_missions row for the flywheel E2E test.
 * Returns the missionId so callers can chain agent runs + publishing jobs.
 */
export function seedCreativeMission(opts: SeedCreativeMissionOptions): SeededCreativeMission {
  const db = openDb();
  ensureTablesExist(db);

  // UUID: GET /api/v1/distribute/jobs/[videoId]/status validates videoId as
  // z.string().uuid() (route.ts:23). The missionId doubles as the videoId in
  // the flywheel spec, so it MUST be a UUID to pass that gate.
  const missionId = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT OR REPLACE INTO creative_missions (
      id, workspace_id, creator_id, title, objective, audience, geography,
      timeframe_start, timeframe_end, channels, monetization_goals,
      constraints, success_metrics, status, current_phase, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    missionId,
    opts.workspaceId,
    opts.userId,
    opts.title,
    opts.objective,
    opts.audience,
    opts.geography,
    now,
    now + 86400,
    JSON.stringify(opts.channels),
    JSON.stringify(opts.monetizationGoals),
    '{}',
    '{}',
    'draft',
    'init',
    now,
    now,
  );

  db.close();
  return { missionId };
}

export interface SeedAgentRunOptions {
  runId: string;
  agentId: string;
  missionId: string;
  workspaceId: string;
  status: string;
  phase: string;
  output: Record<string, unknown>;
}

/**
 * Seed an agent_runs row for a mission. Output is stored as JSON in output_json.
 */
export function seedAgentRun(opts: SeedAgentRunOptions): void {
  const db = openDb();
  ensureTablesExist(db);

  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT OR REPLACE INTO agent_runs (
      id, agent_id, workspace_id, mission_id, status, phase,
      output_json, started_at, ended_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.runId,
    opts.agentId,
    opts.workspaceId,
    opts.missionId,
    opts.status,
    opts.phase,
    JSON.stringify(opts.output),
    now,
    opts.status === 'completed' ? now : null,
    now,
  );

  db.close();
}

export interface SeedPerformanceOptions {
  channel: string;
  eventType: string;
  count: number;
  valueCents: number;
}

/**
 * Seed performance_events rows for a workspace. Each call inserts one event;
 * the caller passes an array to simulate a full performance history.
 */
export function seedPerformanceEvents(
  workspaceId: string,
  missionId: string,
  events: SeedPerformanceOptions[],
): void {
  const db = openDb();
  ensureTablesExist(db);

  // NOTE: recorded_at is stored in MILLISECONDS. The aggregates route
  // (src/app/api/performance/aggregates/route.ts) filters
  // `recorded_at >= Date.now() - 24h`, so seeding seconds-based timestamps
  // would make every event appear 1000x too old and return zero aggregates.
  const now = Date.now();

  const insert = db.prepare(`
    INSERT INTO performance_events (
      id, workspace_id, project_id, event_type, entity_type, entity_id,
      metrics_json, channel, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const e of events) {
    insert.run(
      `e2e-perf-${workspaceId}-${missionId}-${e.eventType}-${now}-${Math.random().toString(36).slice(2, 8)}`,
      workspaceId,
      missionId,
      e.eventType,
      'mission',
      missionId,
      JSON.stringify({ count: e.count, value_cents: e.valueCents }),
      e.channel,
      now,
    );
  }

  db.close();
}

export interface SeedCreativeMemoryOptions {
  workspaceId: string;
  category: string;
  key: string;
  value: Record<string, unknown>;
  confidence: string;
  source: string;
  evidence: string;
}

export interface SeededCreativeMemory {
  id: string;
}

/**
 * Seed a creative_memory row. Uses INSERT OR IGNORE keyed on the
 * uq_creative_memory_active partial unique index (workspace, category, key, scope, scope_id).
 */
export function seedCreativeMemory(opts: SeedCreativeMemoryOptions): SeededCreativeMemory {
  const db = openDb();
  ensureTablesExist(db);

  const now = Math.floor(Date.now() / 1000);
  const id = `e2e-mem-${opts.workspaceId}-${opts.category}-${Date.now().toString(36)}`;

  db.prepare(`
    INSERT OR IGNORE INTO creative_memory (
      id, workspace_id, category, key, value, confidence, source, evidence,
      scope, scope_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'global', NULL, ?, ?)
  `).run(
    id,
    opts.workspaceId,
    opts.category,
    opts.key,
    JSON.stringify(opts.value),
    opts.confidence,
    opts.source,
    JSON.stringify([opts.evidence]),
    now,
    now,
  );

  db.close();
  return { id };
}

export interface SeedPublishingJobOptions {
  id: string;
  tenantId: string;
  videoId: string;
  channelId: string;
  provider: string;
  status: string;
}

/**
 * Seed a publishing_jobs row for the flywheel distribution step.
 *
 * status must satisfy the CHECK constraint in migrations 0091/0101:
 *   'scheduled' | 'uploading' | 'processing' | 'live' | 'failed'
 * 'completed' is not a valid value — callers that want a "done" job should pass 'live'.
 */
export function seedPublishingJob(opts: SeedPublishingJobOptions): void {
  const db = openDb();
  ensureTablesExist(db);

  const VALID_STATUSES = ['scheduled', 'uploading', 'processing', 'live', 'failed'] as const;
  type ValidStatus = (typeof VALID_STATUSES)[number];
  const status: ValidStatus = (VALID_STATUSES as readonly string[]).includes(opts.status)
    ? (opts.status as ValidStatus)
    : 'live';

  const now = Math.floor(Date.now() / 1000);

  // The distribute status route (v1/distribute/jobs/[videoId]/status) enforces
  // ownership via a JOIN on publishing_channels.user_id = session.user.id.
  // Seed a matching publishing_channels row so the seeded job is reachable.
  // publishing_channels schema (migration 0083): id, tenant_id, user_id,
  // provider, external_account_id, access_token, status, created_at, updated_at.
  // No channel_id column — the route joins pj.channel_id = pc.id.
  db.prepare(`
    INSERT OR REPLACE INTO publishing_channels (
      id, tenant_id, user_id, provider, external_account_id,
      access_token, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(
    opts.channelId,
    opts.tenantId,
    opts.tenantId,
    opts.provider,
    opts.channelId,
    'e2e-test-token',
    now,
    now,
  );

  db.prepare(`
    INSERT OR REPLACE INTO publishing_jobs (
      id, tenant_id, video_id, channel_id, status, scheduled_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.id,
    opts.tenantId,
    opts.videoId,
    opts.channelId,
    status,
    now,
    now,
  );

  db.close();
}

/**
 * Tear down all flywheel rows seeded for a workspace (cascade cleanup).
 * Call in test.afterAll to keep local D1 clean.
 */
export function tearDownFlywheel(workspaceId: string, userId?: string): void {
  const db = openDb();

  db.prepare(`DELETE FROM performance_events WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM agent_runs WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM creative_memory WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM creative_missions WHERE workspace_id = ?`).run(workspaceId);
  db.prepare(`DELETE FROM publishing_channels WHERE user_id = ?`).run(userId ?? workspaceId);
  db.prepare(`DELETE FROM publishing_jobs WHERE tenant_id = ?`).run(workspaceId);
  // videos are keyed by user_id, not workspace_id — pass userId when known
  if (userId) db.prepare(`DELETE FROM videos WHERE user_id = ?`).run(userId);

  db.close();
}
