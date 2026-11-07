/**
 * D1 schema boundary harness.
 *
 * The existing integration tests hand-write a SQLite schema (`shared-d1-shim.ts`).
 * That is convenient but blind: a table or column the fake invents is invisible to
 * any real schema, so a test can pass while the production query it models would
 * fail against real D1 with "no such column".
 *
 * This harness closes that gap by deriving its schema from the repository's own
 * migration files and then letting SQLite itself validate every statement.
 *
 * Why SQLite validates rather than a hand-rolled parser: an earlier draft of this
 * harness identified tables and columns with regular expressions. Measured
 * against 1,835 unique production statements it falsely rejected 563 of them —
 * `SELECT COUNT(*) AS cnt`, table aliases (`FROM creators c`), `ON CONFLICT ... DO
 * UPDATE SET`, `UNION` branches, and `json_extract(...)` calls all tripped it. A
 * parser that strict would have sent reviewers chasing drift that does not exist,
 * and the temptation would then be to loosen it until it proves nothing. Preparing
 * the statement against the real schema is both simpler and exact: SQLite either
 * resolves every table and column name or it reports which one it could not.
 *
 * What this harness proves: a query naming a table or column that no migration
 * defines fails here exactly as it does against real D1, because the same engine
 * resolves the names.
 * What it does not prove: D1-specific behaviour — Cloudflare-side constraints,
 * account-level limits, remote latency, or any construct SQLite accepts but D1
 * rejects.
 *
 * Migrations that fail to apply are reported in `skippedMigrations`, never
 * hidden: a schema built from a partial migration chain is a finding to report.
 *
 * @module __tests__/integration/d1-schema-boundary
 */

import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

const req = createRequire(import.meta.url);

type SqliteStatement = {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid?: number | bigint };
};

export type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
};

const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDb;
};

/** Directory holding the numbered migration files, resolved from the app root. */
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

export interface SkippedMigration {
  file: string;
  error: string;
}

export interface SchemaReport {
  migrationFiles: number;
  migrationsApplied: number;
  skippedMigrations: SkippedMigration[];
  tableCount: number;
}

/**
 * Applies every migration in filename order against one in-memory database and
 * returns that database plus a report of what actually took effect.
 *
 * Ordering is the migration contract: `scripts/apply-migrations.sh` applies the
 * same files in the same sequence, so the resulting schema is the one production
 * reaches — including deliberate table retirements such as the `users` →
 * `user` rename.
 */
export function buildSchemaDatabase(): { db: SqliteDb; report: SchemaReport } {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const db = new DatabaseSync(':memory:');
  const skipped: SkippedMigration[] = [];
  let applied = 0;

  for (const file of files) {
    let sql: string;
    try {
      sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    } catch (error) {
      skipped.push({ file, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
    try {
      db.exec(sql);
      applied += 1;
    } catch (error) {
      skipped.push({ file, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const tableRows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>;

  return {
    db,
    report: {
      migrationFiles: files.length,
      migrationsApplied: applied,
      skippedMigrations: skipped,
      tableCount: tableRows.length,
    },
  };
}

export interface SchemaViolation {
  sql: string;
  error: string;
}

/**
 * Prepares the statement against the migration-derived schema and reports the
 * engine's own resolution error, if any.
 *
 * Returns an empty array for a statement the schema resolves, and a single
 * violation carrying SQLite's message — for example "no such table: user_badges"
 * or "table user_streaks has no column named current_streak" — when it does not.
 * Statements containing unresolved interpolation (`${...}`) are reported as
 * violations because they are not executable as written.
 */
export function findSchemaViolations(db: SqliteDb, sql: string): SchemaViolation[] {
  try {
    db.prepare(sql);
    return [];
  } catch (error) {
    return [{ sql, error: error instanceof Error ? error.message : String(error) }];
  }
}

/**
 * Wraps a schema database in a D1-compatible chain API that prepares every
 * statement against the real schema.
 *
 * Validation happens at `prepare()` time, so a violation surfaces on the same
 * line a real "no such column" would appear, rather than as a silent success
 * from a fake that accepted anything.
 */
export function makeSchemaBoundD1(db: SqliteDb) {
  const runStatement = (statement: SqliteStatement, params: unknown[]) => {
    const result = statement.run(...params);
    return {
      success: true,
      meta: {
        changes: Number(result.changes ?? 0),
        last_row_id: Number(result.lastInsertRowid ?? 0),
        duration: 0,
      },
    };
  };

  const prepare = (sql: string) => {
    let statement: SqliteStatement;
    try {
      statement = db.prepare(sql);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Schema boundary violation: ${detail}. SQL: ${sql.trim()}`);
    }
    return {
      bind: (...params: unknown[]) => {
        const sanitized = params.map((param) => (param === undefined ? null : param));
        return {
          first: async <T = Record<string, unknown>>() => {
            const rows = (statement.all as unknown as (...p: unknown[]) => unknown[]).call(
              statement,
              ...sanitized
            );
            return (rows as T[])[0];
          },
          run: async () => runStatement(statement, sanitized),
          all: async <T = Record<string, unknown>>() => ({
            results: statement.all(...sanitized) as T[],
            meta: { changes: 0, last_row_id: 0, duration: 0 },
          }),
        };
      },
      first: async <T = Record<string, unknown>>() => statement.get() as T | undefined,
      run: async () => runStatement(statement, []),
      all: async <T = Record<string, unknown>>() => ({
        results: statement.all() as T[],
        meta: { changes: 0, last_row_id: 0, duration: 0 },
      }),
    };
  };

  const readRows = async (bound: unknown) => {
    const candidate = bound as {
      all?: () => Promise<{ results: unknown[] }>;
      run?: () => Promise<unknown>;
    };
    if (typeof candidate.all === 'function') {
      const all = await candidate.all();
      return all.results;
    }
    if (typeof candidate.run === 'function') {
      await candidate.run();
      return [];
    }
    return null;
  };

  return {
    prepare,
    exec: (sql: string) => db.exec(sql),
    /**
     * D1's `batch()` runs each already-bound statement and returns one result
     * per statement, shaped `{ results, meta }`. Callers reach it in both
     * shapes: `d1.prepare(sql).bind(...)` (bound statement, no further `bind`)
     * and `d1.prepare(sql)` (unbound). Better Auth's D1 schema introspector
     * reads `results` off each entry to enumerate columns via
     * `PRAGMA table_info`, so a batch that returned raw arrays or left entries
     * unexecuted would make every table look columnless — which is how this
     * harness first reported "Database schema mismatch" for a schema the
     * migrations had built correctly.
     */
    batch: async (statements: unknown[]) =>
      Promise.all(
        statements.map(async (statement) => {
          const candidate = statement as {
            bind?: () => unknown;
            all?: () => Promise<{ results: unknown[] }>;
            run?: () => Promise<unknown>;
          };
          if (candidate === null || typeof candidate !== 'object') return statement;

          const bound = typeof candidate.bind === 'function'
            ? (candidate.bind() as typeof candidate)
            : candidate;

          const results = await readRows(bound);
          if (results !== null) {
            return { results, meta: { changes: 0, last_row_id: 0, duration: 0 } };
          }
          return statement;
        })
      ),
  };
}

/** Fresh schema-bound D1 instance plus its schema report. */
export function createSchemaBoundD1() {
  const { db, report } = buildSchemaDatabase();
  return { d1: makeSchemaBoundD1(db), report, db };
}
