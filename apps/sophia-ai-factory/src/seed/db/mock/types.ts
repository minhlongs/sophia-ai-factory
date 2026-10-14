/** Minimal D1 binding interface for prepared statements */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<{ success: boolean; results: unknown[]; meta: { changes: number; last_row_id: number; duration: number } }>;
  all<T = unknown>(): Promise<{ success: boolean; results: T[]; meta: { changes: number; duration: number } }>;
  raw(): Promise<unknown[]>;
}

/** Local D1 database interface (distinct from cloudflare D1Database) */
export interface LocalD1Database {
  prepare(query: string): D1Statement;
  exec(query: string): Promise<void>;
  dump(): Promise<ArrayBuffer>;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
}

export interface D1Result {
  success: boolean;
  results: unknown[];
  meta: { changes: number; last_row_id: number; duration: number };
}

/** Minimal better-sqlite3 interface */
export interface SqliteDb {
  prepare(sql: string): SqliteStmt;
  exec(sql: string): void;
  pragma(sql: string): void;
}

export interface SqliteStmt {
  get(...bindings: unknown[]): Record<string, unknown> | undefined;
  run(...bindings: unknown[]): { changes: number; lastInsertRowid: number };
  all(...bindings: unknown[]): Record<string, unknown>[];
  raw(all: boolean): SqliteStmt;
}
