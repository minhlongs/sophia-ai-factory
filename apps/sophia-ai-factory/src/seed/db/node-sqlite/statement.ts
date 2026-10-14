import { DatabaseSync } from 'node:sqlite';
import type { D1PreparedStatement, D1Result } from '@cloudflare/workers-types';
import { toError } from '@/seed/utils/to-error';

export class NodeSqliteStatement implements D1PreparedStatement {
  private db: DatabaseSync;
  private query: string;
  private bindings: unknown[];

  constructor(db: DatabaseSync, query: string, bindings: unknown[] = []) {
    this.db = db;
    this.query = query;
    // D1 binds booleans as integers (0/1); SQLite's node:sqlite API has no
    // such conversion, so normalize here to match D1 semantics.
    this.bindings = bindings.map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v));
  }

  bind(...values: unknown[]): D1PreparedStatement {
    const resolved = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
    return new NodeSqliteStatement(this.db, this.query, resolved);
  }

  private stmt(): ReturnType<DatabaseSync['prepare']> {
    return this.db.prepare(this.query);
  }

  first<T = unknown>(colName: string): Promise<T | null>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  async first<T = unknown>(colName?: string): Promise<T | null> {
    try {
      const row = this.stmt().get(...this.bindings) as Record<string, unknown> | undefined;
      if (!row) return null;
      return (colName ? row[colName] : row) as T;
    } catch (e) {
      throw new Error(`[node-sqlite-d1] first() failed: ${this.query} — ${toError(e).message}`);
    }
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    try {
      const info = this.stmt().run(...this.bindings);
      const changes = info.changes ?? 0;
      return {
        success: true,
        results: [],
        meta: {
          changes,
          last_row_id: Number(info.lastInsertRowid ?? 0),
          duration: 0,
          size_after: 0,
          rows_read: 0,
          rows_written: changes,
          changed_db: changes > 0,
        },
      };
    } catch (e) {
      throw new Error(`[node-sqlite-d1] run() failed: ${this.query} — ${toError(e).message}`);
    }
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    try {
      const rows = this.stmt().all(...this.bindings) as T[];
      return {
        success: true,
        results: rows,
        meta: {
          changes: 0,
          last_row_id: 0,
          duration: 0,
          size_after: 0,
          rows_read: rows.length,
          rows_written: 0,
          changed_db: false,
        },
      };
    } catch (e) {
      throw new Error(`[node-sqlite-d1] all() failed: ${this.query} — ${toError(e).message}`);
    }
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  async raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<[string[], ...T[]] | T[]> {
    try {
      return this.stmt().all(...this.bindings) as unknown as T[];
    } catch (e) {
      throw new Error(`[node-sqlite-d1] raw() failed: ${this.query} — ${toError(e).message}`);
    }
  }
}
