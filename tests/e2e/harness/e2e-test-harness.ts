/**
 * E2E Test Harness — In-Memory D1 Database Shim
 *
 * Provides deterministic, in-memory SQLite (node:sqlite) primitives
 * conforming to Cloudflare D1Database interface for testing database-dependent flows.
 *
 * All business logic functions are imported directly from production modules
 * in `apps/sophia-ai-factory/src/`.
 *
 * @module tests/e2e/harness/e2e-test-harness
 */

import { createRequire } from 'node:module';
import { E2E_D1_SCHEMA } from './mock-db-schema';

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

type StatementSync = ReturnType<InstanceType<typeof DatabaseSync>['prepare']>;

// ─── D1 Compatible In-Memory SQLite Shim ─────────────────────────────────────

export interface MockD1Database {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | undefined>;
      run(): Promise<{ success: boolean; meta: { changes: number; duration: number } }>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta: { changes: number; duration: number } }>;
    };
    first<T = Record<string, unknown>>(): Promise<T | undefined>;
    run(): Promise<{ success: boolean; meta: { changes: number; duration: number } }>;
    all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta: { changes: number; duration: number } }>;
  };
  exec(sql: string): void;
  batch(stmts: unknown[]): Promise<unknown[]>;
  rawDb: InstanceType<typeof DatabaseSync>;
}

export function createInMemoryD1(): MockD1Database {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(E2E_D1_SCHEMA);

  const mockDb: MockD1Database = {
    rawDb: db,
    exec(sql: string) {
      db.exec(sql);
    },
    async batch(stmts: unknown[]) {
      const results: unknown[] = [];
      for (const stmt of stmts as Array<{ run(): Promise<unknown> }>) {
        results.push(await stmt.run());
      }
      return results;
    },
    prepare(sql: string) {
      const stmt: StatementSync = db.prepare(sql);
      return {
        bind(...params: unknown[]) {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            async first<T = Record<string, unknown>>() {
              return (stmt.get(...sanitized) as T) ?? undefined;
            },
            async run() {
              const res = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(res.changes ?? 0), duration: 0 } };
            },
            async all<T = Record<string, unknown>>() {
              const rows = stmt.all(...sanitized) as T[];
              return { results: rows, meta: { changes: 0, duration: 0 } };
            },
          };
        },
        async first<T = Record<string, unknown>>() {
          return (stmt.get() as T) ?? undefined;
        },
        async run() {
          const res = stmt.run();
          return { success: true, meta: { changes: Number(res.changes ?? 0), duration: 0 } };
        },
        async all<T = Record<string, unknown>>() {
          const rows = stmt.all() as T[];
          return { results: rows, meta: { changes: 0, duration: 0 } };
        },
      };
    },
  };

  return mockDb;
}
