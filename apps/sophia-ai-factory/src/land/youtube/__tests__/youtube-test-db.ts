/**
 * Shared test-DB helper for land/youtube modules.
 *
 * Boots an in-memory SQLite D1 shim with the YouTube content-pipeline tables
 * from migration 0252 so repo functions can be exercised end-to-end
 * without a live Cloudflare D1 binding.
 *
 * @module land/youtube/__tests__/youtube-test-db
 */

import { createRequire } from 'node:module';
import { vi } from 'vitest';
import { getD1 } from '@/seed/db/client';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

/** Subset of migration 0252 covering tables touched by land/youtube. */
export const YOUTUBE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS youtube_channel_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  objective TEXT NOT NULL,
  audience TEXT NOT NULL,
  content_pillars TEXT NOT NULL,
  cadence TEXT NOT NULL,
  posts_per_week INTEGER NOT NULL DEFAULT 3,
  guardrails TEXT,
  content_buffer_days INTEGER NOT NULL DEFAULT 3,
  autonomy_level INTEGER NOT NULL DEFAULT 2,
  is_active INTEGER NOT NULL DEFAULT 1,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS youtube_content_calendar (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel_config_id TEXT,
  title TEXT NOT NULL,
  topic TEXT,
  content_type TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at TEXT NOT NULL,
  strategy_id TEXT,
  script_id TEXT,
  seo_id TEXT,
  production_id TEXT,
  published_video_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS youtube_pipeline_checkpoints (
  job_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  artifact TEXT,
  error TEXT,
  started_at TEXT,
  completed_at TEXT,
  attempt INTEGER,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (job_id, stage)
);
`;

export interface YouTubeTestDb {
  raw: InstanceType<typeof DatabaseSync>;
  db: D1Database;
  /**
   * Override the default `first()` return value for a specific SQL pattern.
   * The first matching pattern wins. Useful for COUNT(*) / aggregate queries
   * that the generic row-shim can't answer.
   */
  setFirstImpl(pattern: RegExp, value: unknown): void;
  /**
   * Override the default `run()` meta for a specific SQL pattern.
   * Useful for UPDATE/DELETE statements that should report 0 changes.
   */
  setRunMeta(pattern: RegExp, meta: { changes?: number; success?: boolean }): void;
}

export function createYouTubeTestDb(): YouTubeTestDb {
  const raw = new DatabaseSync(':memory:');
  raw.exec(YOUTUBE_SCHEMA_SQL);

  const firstImpls: Array<{ pattern: RegExp; value: unknown }> = [];
  const runImpls: Array<{ pattern: RegExp; meta: { changes?: number; success?: boolean } }> = [];

  const db = {
    prepare(sql: string) {
      const stmt = raw.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() => {
              const impl = firstImpls.find((i) => i.pattern.test(sql));
              if (impl) return impl.value as T;
              return stmt.get(...sanitized) as T | undefined;
            },
            run: async () => {
              const impl = runImpls.find((i) => i.pattern.test(sql));
              if (impl) {
                const changes = impl.meta.changes ?? 0;
                return {
                  success: impl.meta.success ?? true,
                  changes,
                  meta: { changes, duration: 0 },
                };
              }
              const r = stmt.run(...sanitized);
              const changes = Number(r.changes ?? 0);
              return { success: true, changes, meta: { changes, duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          const changes = Number(r.changes ?? 0);
          return { success: true, changes, meta: { changes, duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: (sql: string) => raw.exec(sql),
    batch: (stmts: unknown[]) => Promise.all(stmts),
  };

  return {
    raw,
    db: db as unknown as D1Database,
    setFirstImpl(pattern: RegExp, value: unknown) {
      firstImpls.unshift({ pattern, value });
    },
    setRunMeta(pattern: RegExp, meta: { changes?: number; success?: boolean }) {
      runImpls.unshift({ pattern, meta });
    },
  };
}

/**
 * Point the mocked getD1() at a fresh in-memory YouTube DB.
 * Safe to call in beforeEach after vi.mock('@/seed/db/client') is hoisted.
 */
export function mockYouTubeD1(): YouTubeTestDb {
  const db = createYouTubeTestDb();
  vi.mocked(getD1).mockResolvedValue(db.db as Awaited<ReturnType<typeof getD1>>);
  return db;
}