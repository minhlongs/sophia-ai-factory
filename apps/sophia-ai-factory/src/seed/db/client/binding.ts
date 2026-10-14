import type { D1Database } from '@cloudflare/workers-types';
import { loadLocalD1, getMockLoader } from './loader';

/**
 * Get D1Database binding asynchronously from CF request context.
 * Returns null if binding is unavailable (non-fatal).
 */
export async function getD1(): Promise<D1Database | null> {
  try {
    const envDouble = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
    if (envDouble?.DB) return envDouble.DB as D1Database;

    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;

    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;

    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    if (globalDb) return globalDb;

    const localDb = await loadLocalD1();
    if (localDb) {
      (globalThis as Record<string, unknown>).__D1_DB = localDb;
      return localDb;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get D1 database binding synchronously from CF request context.
 */
export function getD1Sync(): D1Database {
  const envDouble = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
  if (envDouble?.DB && typeof (envDouble.DB as D1Database).prepare === 'function') {
    return envDouble.DB as D1Database;
  }

  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB && typeof (env.DB as D1Database).prepare === 'function') {
    return env.DB as D1Database;
  }

  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
    Symbol.for('__cloudflare-context__')
  ];
  if (ctx?.env?.DB && typeof (ctx.env.DB as D1Database).prepare === 'function') {
    return ctx.env.DB as D1Database;
  }

  const procEnv = (process as unknown as Record<string, Record<string, unknown>>).env;
  if (procEnv?.DB && typeof (procEnv.DB as D1Database).prepare === 'function') {
    return procEnv.DB as D1Database;
  }

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;

  const mockLoader = getMockLoader();
  if (mockLoader) {
    const loader = mockLoader() as () => unknown;
    const mockDb = loader();
    if (mockDb && typeof (mockDb as D1Database).prepare === 'function') {
      (globalThis as Record<string, unknown>).__D1_DB = mockDb;
      return mockDb as D1Database;
    }
  }

  throw new Error('D1 database binding not available — call getD1() first to resolve local shim');
}

/**
 * @deprecated Use getD1() — async wrapper for backward compatibility.
 */
export async function getD1Raw(): Promise<D1Database> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  return db;
}

/**
 * @deprecated Use getD1() — async wrapper for backward compatibility.
 */
export async function getD1Safe(): Promise<D1Database | null> {
  return await getD1();
}
