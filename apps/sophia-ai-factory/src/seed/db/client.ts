/**
 * D1 Database Client — drop-in replacement for Supabase client
 *
 * Uses getCloudflareContext() from @opennextjs/cloudflare to access
 * the D1 binding at runtime. DB binding: sophia-raas-db
 */

import { D1Client } from '@/seed/db/d1-client-rpc';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import type { D1Database } from '@cloudflare/workers-types';
export type { D1Database };
export { D1Client };

// Lazy dynamic load of local D1 mock to prevent Edge runtime bundle contamination
let getLocalD1Mock: (() => unknown) | null = null;
if (process.env.NEXT_RUNTIME !== 'edge') {
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    getLocalD1Mock = require('./local-d1-mock').getLocalD1Mock;
  } catch {
    // ignore if not in Node.js context or file missing
  }
}

/**
 * Get D1Database binding synchronously from CF request context.
 * Returns null if binding is unavailable (non-fatal).
 * Consolidated here as the single canonical accessor.
 */
export function getD1(): D1Database | null {
  try {
    // Primary: globalThis.__env (set by opennextjs-cloudflare worker)
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;

    // Fallback: Cloudflare context symbol
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;

    // Fallback: global test binding
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    if (globalDb) return globalDb;

    // Fallback: local dev sqlite mock
    if (getLocalD1Mock) {
      const mockDb = getLocalD1Mock();
      if (mockDb) {
        (globalThis as Record<string, unknown>).__D1_DB = mockDb;
        return mockDb as D1Database;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * @deprecated Use getD1() — async wrapper for backward compatibility.
 */
export async function getD1Raw(): Promise<D1Database> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  return db;
}

/**
 * @deprecated Use getD1() — async wrapper for backward compatibility.
 */
export async function getD1Safe(): Promise<D1Database | null> {
  return getD1();
}

/**
 * @deprecated Use createServerClient() instead.
 */
export async function getD1Client(override?: D1Database): Promise<D1Client> {
  const db = override ?? getD1();
  if (!db) throw new Error('D1 database binding not available');
  return new D1Client(db);
}

/**
 * Get D1 database binding synchronously from CF request context.
 */
function getD1Sync(): D1Database {
  // Try globalThis.__env (set by opennextjs-cloudflare worker)
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;

  // Try process.env style (some CF adapters)
  const procEnv = (process as unknown as Record<string, Record<string, unknown>>).env;
  if (procEnv?.DB && typeof (procEnv.DB as D1Database).prepare === 'function') {
    return procEnv.DB as D1Database;
  }

  // Fallback: global test binding
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;

  // Fallback: local dev sqlite mock
  if (getLocalD1Mock) {
    const mockDb = getLocalD1Mock();
    if (mockDb) {
      (globalThis as Record<string, unknown>).__D1_DB = mockDb;
      return mockDb as D1Database;
    }
  }

  throw new Error('D1 database binding not available');
}

/**
 * Get D1 binding via Cloudflare context symbol set by opennextjs-cloudflare
 */
async function getD1Async(): Promise<D1Database> {
  const ctxSymbol = Symbol.for('__cloudflare-context__');
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol];
  if (ctx?.env?.DB) {
    return ctx.env.DB as D1Database;
  }

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const cfCtx = await getCloudflareContext();
    const db = (cfCtx.env as Record<string, unknown>).DB as D1Database;
    if (db) return db;
  } catch {
    /* not available */
  }

  return getD1Sync();
}

/**
 * Create a server-side D1 client.
 * Drop-in replacement for Supabase createServerClient().
 */
export function createServerClient(override?: D1Database): D1Client {
  const db = override ?? getD1Sync();
  if (!db) throw new Error('D1 database binding not available');

  return new D1Client(db);
}

/**
 * Lazy query chain that resolves D1 binding when executing.
 */
class LazyQueryChain {
  private calls: { method: string; args: unknown[] }[] = [];
  private table: string;
  private getDb: () => Promise<D1Database>;

  constructor(table: string, getDb: () => Promise<D1Database>) {
    this.table = table;
    this.getDb = getDb;

    const proxy: LazyQueryChain = new Proxy(this, {
      get(target, prop) {
        if (prop === 'then') {
          return (
            onfulfilled: (v: unknown) => unknown,
            onrejected: (e: unknown) => unknown,
          ) => target.execute().then(onfulfilled, onrejected);
        }

        if (prop === 'single' || prop === 'maybeSingle') {
          return () => {
            target.calls.push({ method: prop as string, args: [] });
            return target.execute();
          };
        }

        return (...args: unknown[]) => {
          target.calls.push({ method: prop as string, args });
          return proxy;
        };
      },
    }) as unknown as LazyQueryChain;
    return proxy;
  }

  private async execute() {
    try {
      const db = await this.getDb();
      const client = new D1Client(db);
      let chain = client.from(this.table) as unknown as Record<string, (...args: unknown[]) => unknown>;
      for (const call of this.calls) {
        const result = chain[call.method](...call.args);
        if (result instanceof Promise) return result;
        chain = result as Record<string, (...args: unknown[]) => unknown>;
      }
      return chain;
    } catch (err) {
      const d1Err = err instanceof Error ? err : new Error(String(err));
      logger.error('[D1Client] LazyQueryChain execution failed', d1Err);
      throw d1Err;
    }
  }
}

/**
 * Compatibility shim for createAuthClient(token).
 * @deprecated Use getCurrentUser() from '@/seed/auth/better-auth-session' instead.
 */
export function createAuthClient(_token?: string) {
  return {
    auth: {
      async getUser() {
        try {
          const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
          const user = await getCurrentUser();
          if (!user) return { data: { user: null }, error: { message: 'Not authenticated' } };
          return { data: { user }, error: null };
        } catch (e) {
          return { data: { user: null }, error: { message: toError(e).message } };
        }
      },
    },
    from: (table: string) => createServerClient().from(table),
    rpc: (fn: string, params: Record<string, unknown>) => createServerClient().rpc(fn, params),
  };
}

// Re-export compatible types
export type User = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
};

export type Session = {
  access_token: string;
  user: User;
  expires_at: number;
};

export type AuthError = {
  message: string;
  status?: number;
};

export type PostgrestError = {
  message: string;
  code?: string;
};
