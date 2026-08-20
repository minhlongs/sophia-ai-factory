// @ts-nocheck — dev/test shim only. node:sqlite (Node 22 built-in) has no type
// declarations in @types/node, and @cloudflare/workers-types does not export
// D1Statement/D1Meta as named types (they are abstract classes). The shim
// mirrors the D1 binding surface at runtime; type-checking it adds noise to
// the production tsc baseline for zero benefit.

/**
 * node:sqlite-backed D1 shim — dev/test fallback for the Cloudflare D1 binding.
 *
 * Why this exists:
 *   The previous local D1 mock (local-d1-mock.ts) is built on better-sqlite3.
 *   In the Turbopack edge chunk (middleware/proxy, which runs on Node.js in
 *   dev) the `node:module` package is stubbed by Turbopack, so `createRequire`
 *   is unreachable and the mock never initializes — every D1-backed check
 *   fails-closed (429). Node 22 ships `node:sqlite` as a built-in, and Turbopack
 *   externalizes it the same way it externalizes `node:buffer`
 *   (__turbopack_context__.x("node:sqlite", () => require("node:sqlite"))),
 *   which is reachable at runtime. This shim uses only `node:sqlite`, so the
 *   entire createRequire/better-sqlite3 chain is bypassed.
 *
 * It implements the subset of the D1 binding surface that the rate-limit and
 * auth paths exercise: prepare()/bind()/first()/all()/run()/raw()/batch()/exec().
 * It is NOT a general-purpose D1 emulator — it exists to unblock local dev.
 *
 * Not used in production: the Cloudflare D1 binding (globalThis.__env__.DB) is
 * always resolved first by getD1(). This module is dev/test-only.
 */

import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { D1Database, D1Statement, D1Result } from '@cloudflare/workers-types';

// ─── Statement ────────────────────────────────────────────────────────────────

class NodeSqliteStatement implements D1Statement {
  private db: InstanceType<typeof DatabaseSync>;
  private query: string;
  private bindings: unknown[];

  constructor(
    db: InstanceType<typeof DatabaseSync>,
    query: string,
    bindings: unknown[] = [],
  ) {
    this.db = db;
    this.query = query;
    // D1 binds booleans as integers (0/1); SQLite's node:sqlite API has no
    // such conversion, so normalize here to match D1 semantics.
    this.bindings = bindings.map(v => (typeof v === 'boolean' ? (v ? 1 : 0) : v));
  }

  bind(...values: unknown[]): D1Statement {
    const resolved = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
    return new NodeSqliteStatement(this.db, this.query, resolved);
  }

  private stmt(): InstanceType<typeof DatabaseSync.prepare> {
    return this.db.prepare(this.query);
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    try {
      const row = this.stmt().get(...this.bindings) as Record<string, unknown> | undefined;
      if (!row) return null;
      return (colName ? row[colName] : row) as T;
    } catch (e) {
      throw new Error(`[node-sqlite-d1] first() failed: ${this.query} — ${(e as Error).message}`);
    }
  }

  async run(): Promise<D1Result> {
    try {
      const info = this.stmt().run(...this.bindings);
      return {
        success: true,
        results: [],
        meta: {
          changes: info.changes ?? 0,
          last_row_id: Number(info.lastInsertRowid ?? 0),
          duration: 0,
        },
      };
    } catch (e) {
      throw new Error(`[node-sqlite-d1] run() failed: ${this.query} — ${(e as Error).message}`);
    }
  }

  async all<T = unknown>(): Promise<{ success: boolean; results: T[]; meta: { changes: number; duration: number } }> {
    try {
      const rows = this.stmt().all(...this.bindings) as Record<string, unknown>[];
      return { success: true, results: rows as T[], meta: { changes: 0, duration: 0 } };
    } catch (e) {
      throw new Error(`[node-sqlite-d1] all() failed: ${this.query} — ${(e as Error).message}`);
    }
  }

  async raw(): Promise<unknown[]> {
    try {
      return this.stmt().all(...this.bindings) as unknown[];
    } catch (e) {
      throw new Error(`[node-sqlite-d1] raw() failed: ${this.query} — ${(e as Error).message}`);
    }
  }
}

// ─── Database ─────────────────────────────────────────────────────────────────

export class NodeSqliteD1Database implements D1Database {
  private db: InstanceType<typeof DatabaseSync>;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    // D1 runs WITHOUT foreign key enforcement by default; mirror that so the
    // local mock behaves like production instead of being stricter.
    // DatabaseSync has no .pragma() helper — exec the PRAGMA directly.
    this.db.exec('PRAGMA foreign_keys = OFF');
    applyMigrations(this.db);
  }

  prepare(query: string): D1Statement {
    return new NodeSqliteStatement(this.db, query);
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error('Dump not implemented in node:sqlite D1 shim');
  }

  async batch(statements: D1Statement[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const s of statements) results.push(await s.run());
    return results;
  }

  async exec(query: string): Promise<void> {
    this.db.exec(query);
  }
}

// ─── Migrations ───────────────────────────────────────────────────────────────

/**
 * Apply the canonical migration set so the local shim mirrors the production
 * schema. Without this, every D1-backed check (auth rate limiting, quota
 * enforcement, circuit breaker) fails with "no such table" and fail-closed,
 * denying all requests with 429.
 *
 * Failures are non-fatal: migrations with ALTER/DROP on partially-migrated
 * state are skipped, and CREATE TABLE IF NOT EXISTS is idempotent.
 */
function applyMigrations(db: InstanceType<typeof DatabaseSync>): void {
  try {
    const cwd = (process as unknown as { cwd?: () => string }).cwd?.() ?? '';
    const migDir = path.resolve(cwd, '../../migrations');
    if (!fs.existsSync(migDir)) return;
    const files = fs.readdirSync(migDir).filter((f: string) => f.endsWith('.sql')).sort();
    for (const f of files) {
      try {
        db.exec(fs.readFileSync(path.join(migDir, f), 'utf-8'));
      } catch {
        // Non-fatal: skip migrations that depend on partial state
      }
    }
  } catch {
    // Non-fatal: migrations are best-effort for the local shim
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve a writable local D1 shim for dev/test. Returns null when the
 * node:sqlite built-in is unavailable or no local DB file can be found.
 */
export function getLocalNodeSqliteD1(): NodeSqliteD1Database | null {
  try {
    const cwd = (process as unknown as { cwd?: () => string }).cwd?.() ?? '';
    const homeDir = (process as unknown as { env?: Record<string, string | undefined> }).env?.HOME ?? '';
    const candidates = [
      path.resolve(cwd, '../..', '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
      path.resolve(cwd, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
      path.resolve(cwd, '..', '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
      ...(homeDir
        ? [
            path.resolve(homeDir, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
            path.resolve(homeDir, '.wrangler/state/v3/d1'),
          ]
        : []),
    ];

    let newestFile: string | null = null;
    let newestTime = 0;
    for (const base of candidates) {
      if (!fs.existsSync(base)) continue;
      const files = fs
        .readdirSync(base)
        .filter((f: string) => f.endsWith('.sqlite') && !f.includes('metadata'))
        .map((f: string) => path.join(base, f));
      for (const file of files) {
        let maxFileTime = 0;
        for (const ext of ['', '-wal', '-shm']) {
          try {
            const stats = fs.statSync(file + ext);
            if (stats.mtimeMs > maxFileTime) maxFileTime = stats.mtimeMs;
          } catch {}
        }
        if (maxFileTime > newestTime) {
          newestTime = maxFileTime;
          newestFile = file;
        }
      }
    }

    if (!newestFile) return null;
    return new NodeSqliteD1Database(newestFile);
  } catch {
    return null;
  }
}