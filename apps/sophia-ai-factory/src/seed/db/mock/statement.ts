import { logger } from '@/seed/utils/logger-utility';
import type { D1Statement, SqliteDb } from './types';

export class SQLiteD1PreparedStatement implements D1Statement {
  private db: SqliteDb;
  private query: string;
  private bindings: unknown[];

  constructor(db: SqliteDb, query: string, bindings: unknown[] = []) {
    this.db = db;
    this.query = query;
    this.bindings = bindings.map(v => (typeof v === 'boolean' ? (v ? 1 : 0) : v));
  }

  bind(...values: unknown[]): D1Statement {
    const resolvedValues = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
    return new SQLiteD1PreparedStatement(this.db, this.query, resolvedValues);
  }

  private getProcessedBindings(): Record<string, unknown> | unknown[] {
    if (/\?\d+/.test(this.query) && Array.isArray(this.bindings)) {
      const boundObj: Record<string, unknown> = {};
      this.bindings.forEach((val, idx) => {
        boundObj[String(idx + 1)] = val;
      });
      return boundObj;
    }
    return this.bindings;
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    try {
      const stmt = this.db.prepare(this.query);
      const processed = this.getProcessedBindings();
      const result = Array.isArray(processed) ? stmt.get(...processed) : stmt.get(processed);
      if (!result) return null;
      if (colName) return result[colName] as T;
      return result as T;
    } catch (e) {
      logger.error(
        `[D1 mock] error on first(): ${this.query}`,
        e instanceof Error ? e : new Error(String(e))
      );
      throw e;
    }
  }

  async run(): Promise<{
    success: boolean;
    results: unknown[];
    meta: { changes: number; last_row_id: number; duration: number };
  }> {
    try {
      const stmt = this.db.prepare(this.query);
      const processed = this.getProcessedBindings();
      const info = Array.isArray(processed) ? stmt.run(...processed) : stmt.run(processed);
      return {
        success: true,
        results: [],
        meta: {
          changes: info.changes,
          last_row_id: info.lastInsertRowid,
          duration: 0,
        },
      };
    } catch (e) {
      logger.error(
        `[D1 mock] error on run(): ${this.query}`,
        e instanceof Error ? e : new Error(String(e))
      );
      throw e;
    }
  }

  async all<T = unknown>(): Promise<{
    success: boolean;
    results: T[];
    meta: { changes: number; duration: number };
  }> {
    try {
      const stmt = this.db.prepare(this.query);
      const processed = this.getProcessedBindings();
      const rawResults = Array.isArray(processed) ? stmt.all(...processed) : stmt.all(processed);
      return {
        success: true,
        results: rawResults as unknown as T[],
        meta: {
          changes: 0,
          duration: 0,
        },
      };
    } catch (e) {
      logger.error(
        `[D1 mock] error on all(): ${this.query}`,
        e instanceof Error ? e : new Error(String(e))
      );
      throw e;
    }
  }

  async raw(): Promise<unknown[]> {
    try {
      const stmt = this.db.prepare(this.query);
      const processed = this.getProcessedBindings();
      const rawResult = Array.isArray(processed)
        ? stmt.raw(true).all(...processed)
        : stmt.raw(true).all(processed);
      return rawResult as unknown[];
    } catch (e) {
      logger.error(
        `[D1 mock] error on raw(): ${this.query}`,
        e instanceof Error ? e : new Error(String(e))
      );
      throw e;
    }
  }
}
