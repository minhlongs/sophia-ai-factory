/**
 * Fake D1Database backed by SQLite.
 *
 * Implements the subset of D1Database used by DB-boundary tests:
 *   - prepare(sql).bind(...args).run()   → D1RunResult (with meta.changes)
 *   - prepare(sql).bind(...args).first() → T | null
 *   - prepare(sql).bind(...args).all()   → { results: T[] }
 *
 * The preferred driver is better-sqlite3 (used in CI). Some sandboxes cannot
 * compile its native bindings (no access to nodejs.org header downloads); in
 * that case we fall back to Node 22's built-in `node:sqlite`, which is the same
 * SQLite engine family as Cloudflare D1. Both drivers run the exact same SQL,
 * so UNIQUE indexes, ON CONFLICT and transactions are exercised for real.
 *
 * Does NOT implement batch(), dump() or exec() on the D1 facade.
 */

import DatabaseConstructor from 'better-sqlite3';
import type { Database as SqliteDb } from 'better-sqlite3';
import { createRequire } from 'node:module';

export interface FakeD1RunResult {
  success: true;
  meta: {
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
    duration: number;
  };
  results?: unknown[];
}

export interface FakeD1Statement {
  bind(...args: unknown[]): FakeD1Statement;
  run(): Promise<FakeD1RunResult>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[]; success: true; meta: unknown }>;
}

interface SqliteRunInfo {
  changes: number;
  lastInsertRowid: number | bigint;
}

interface PortableStatement {
  run(...args: unknown[]): SqliteRunInfo;
  get(...args: unknown[]): unknown;
  all(...args: unknown[]): unknown[];
}

interface PortableDatabase {
  pragma(source: string): void;
  exec(sql: string): void;
  prepare(sql: string): PortableStatement;
}

export interface FakeD1 {
  prepare(sql: string): FakeD1Statement;
  batch<T = unknown>(statements: FakeD1Statement[]): Promise<FakeD1RunResult[]>;
  _db: PortableDatabase;
  /** Which SQLite driver backs this instance — useful in verification logs. */
  _driver: 'better-sqlite3' | 'node:sqlite';
}

interface NodeSqliteModule {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): PortableStatement;
  };
}

function openDatabase(): { db: PortableDatabase; driver: FakeD1['_driver'] } {
  try {
    const db = new DatabaseConstructor(':memory:') as unknown as PortableDatabase;
    return { db, driver: 'better-sqlite3' };
  } catch {
    // Native binding unavailable. Node's built-in SQLite is experimental in
    // Node 22 but is present in the CI/test Node version and needs no download.
    const localRequire = createRequire(import.meta.url);
    const nodeSqlite = localRequire('node:sqlite') as NodeSqliteModule;
    const raw = new nodeSqlite.DatabaseSync(':memory:');
    const db: PortableDatabase = {
      pragma: () => undefined,
      exec: (sql: string) => raw.exec(sql),
      prepare: (sql: string) => raw.prepare(sql),
    };
    return { db, driver: 'node:sqlite' };
  }
}

export function createFakeD1(schemaStatements: string[] = []): FakeD1 {
  const { db, driver } = openDatabase();
  db.pragma('journal_mode = WAL');

  for (const stmt of schemaStatements) {
    db.exec(stmt);
  }

  function makeStatement(sql: string, boundArgs: unknown[] = []): FakeD1Statement {
    const stmt: FakeD1Statement & { _sql?: string; _args?: unknown[] } = {
      _sql: sql,
      _args: boundArgs,
      bind(...args: unknown[]): FakeD1Statement {
        return makeStatement(sql, [...boundArgs, ...args]);
      },
      async run(): Promise<FakeD1RunResult> {
        const compiled = db.prepare(sql);
        const info = compiled.run(...boundArgs);
        return {
          success: true,
          meta: {
            changes: info.changes,
            last_row_id: Number(info.lastInsertRowid),
            rows_read: 0,
            rows_written: info.changes,
            duration: 0,
          },
        };
      },
      async first<T = unknown>(): Promise<T | null> {
        const compiled = db.prepare(sql);
        const row = compiled.get(...boundArgs);
        return (row as T) ?? null;
      },
      async all<T = unknown>(): Promise<{ results: T[]; success: true; meta: unknown }> {
        const compiled = db.prepare(sql);
        const rows = compiled.all(...boundArgs);
        return { results: rows as T[], success: true, meta: {} };
      },
    };
    return stmt;
  }

  return {
    prepare(sql: string): FakeD1Statement {
      return makeStatement(sql);
    },
    async batch<T = unknown>(statements: FakeD1Statement[]): Promise<FakeD1RunResult[]> {
      db.exec('BEGIN TRANSACTION;');
      try {
        const batchResults: FakeD1RunResult[] = [];
        for (const s of statements) {
          // @ts-expect-error accessing internal bound args
          const { _sql, _args } = s;
          const compiled = db.prepare(_sql);
          const info = compiled.run(..._args);
          batchResults.push({
            success: true,
            meta: {
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid),
              rows_read: 0,
              rows_written: info.changes,
              duration: 0,
            },
          });
        }
        db.exec('COMMIT;');
        return batchResults;
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    },
    _db: db,
    _driver: driver,
  };
}

// Retained for tests that want to type the underlying driver explicitly.
export type { SqliteDb };
