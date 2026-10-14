import { DatabaseSync } from 'node:sqlite';
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
  D1ExecResult,
  D1DatabaseSession,
  D1SessionBookmark,
  D1SessionConstraint,
} from '@cloudflare/workers-types';
import { NodeSqliteStatement } from './statement';
import { applyMigrations } from './migrations';

export class NodeSqliteD1Database implements D1Database {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    // D1 runs WITHOUT foreign key enforcement by default; mirror that so the
    // local mock behaves like production instead of being stricter.
    // DatabaseSync has no .pragma() helper — exec the PRAGMA directly.
    this.db.exec('PRAGMA foreign_keys = OFF');
    applyMigrations(this.db);
  }

  prepare(query: string): D1PreparedStatement {
    return new NodeSqliteStatement(this.db, query);
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error('Dump not implemented in node:sqlite D1 shim');
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    for (const s of statements) results.push(await s.run<T>());
    return results;
  }

  async exec(query: string): Promise<D1ExecResult> {
    this.db.exec(query);
    return { count: 0, duration: 0 };
  }

  withSession(
    _constraintOrBookmark?: D1SessionBookmark | D1SessionConstraint,
  ): D1DatabaseSession {
    return {
      prepare: (q: string) => this.prepare(q),
      batch: <T = unknown>(stmts: D1PreparedStatement[]) => this.batch<T>(stmts),
      getBookmark: () => null,
    };
  }
}
