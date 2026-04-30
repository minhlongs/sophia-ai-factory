/**
 * Fake D1Database backed by better-sqlite3.
 * Implements the subset of D1Database used by per-channel-quota and publish-execute:
 *   - prepare(sql).bind(...args).run()   → D1RunResult (with meta.changes)
 *   - prepare(sql).bind(...args).first() → T | null
 *
 * Does NOT implement batch(), dump(), or exec().
 */

import Database from 'better-sqlite3';

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

export interface FakeD1 {
  prepare(sql: string): FakeD1Statement;
  _db: Database.Database;
}

export function createFakeD1(schemaStatements: string[] = []): FakeD1 {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  for (const stmt of schemaStatements) {
    db.exec(stmt);
  }

  function makeStatement(sql: string, boundArgs: unknown[] = []): FakeD1Statement {
    const stmt: FakeD1Statement = {
      bind(...args: unknown[]): FakeD1Statement {
        return makeStatement(sql, [...boundArgs, ...args]);
      },
      async run(): Promise<FakeD1RunResult> {
        const compiled = db.prepare(sql);
        const info = compiled.run(...(boundArgs as Parameters<typeof compiled.run>));
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
        const row = compiled.get(...(boundArgs as Parameters<typeof compiled.get>));
        return (row as T) ?? null;
      },
      async all<T = unknown>(): Promise<{ results: T[]; success: true; meta: unknown }> {
        const compiled = db.prepare(sql);
        const rows = compiled.all(...(boundArgs as Parameters<typeof compiled.all>));
        return { results: rows as T[], success: true, meta: {} };
      },
    };
    return stmt;
  }

  return {
    prepare(sql: string): FakeD1Statement {
      return makeStatement(sql);
    },
    _db: db,
  };
}
