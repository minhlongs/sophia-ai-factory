/**
 * Workflow D1 Binding and ID Utilities
 * Layer: SEED (Foundational Primitives)
 */

export function getD1(): D1Database {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;

  const ctxSymbol = Symbol.for('__cloudflare-context__');
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol];
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;

  throw new Error('[workflow-repository] D1 binding not available');
}

/** Generate a 16-byte hex id (SQLite-compatible) */
export function newId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
