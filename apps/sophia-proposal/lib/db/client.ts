/**
 * D1 Database Client — drop-in replacement for lib/db/client.ts
 *
 * Uses getCloudflareContext() from @opennextjs/cloudflare to access
 * the D1 binding at runtime. All existing code can simply change:
 *   import { createServerClient } from '@/lib/db/client'
 * to:
 *   import { createServerClient } from '@/lib/db/client'
 */

import { D1Client } from './d1-query-builder';

let cachedClient: D1Client | null = null;

/**
 * Get D1 database binding from Cloudflare Workers runtime.
 * Falls back to a global __D1_DB for testing/dev.
 */
async function getD1Binding(): Promise<D1Database> {
  // In CF Workers/Pages, use opennextjs-cloudflare context
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const db = (ctx.env as Record<string, unknown>).DB as D1Database;
    if (db) return db;
  } catch {
    // Not in CF runtime — check global fallback (for tests/local dev)
  }

  // Global fallback for local dev / miniflare
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;

  throw new Error('D1 database binding not available. Are you running in Cloudflare Workers?');
}

/**
 * Create a server-side D1 client.
 * Drop-in replacement for Supabase createServerClient().
 */
export function createServerClient(): D1Client {
  // Return sync wrapper that lazily resolves D1 binding
  // Since D1Client needs the binding immediately, we use a proxy
  // that resolves on first use.
  if (cachedClient) return cachedClient;

  // Create a proxy that resolves the D1 binding on first method call
  return new Proxy({} as D1Client, {
    get(_target, prop) {
      if (prop === 'then') return undefined; // Prevent auto-await of proxy

      return (...args: unknown[]) => {
        return getD1Binding().then((db) => {
          cachedClient = new D1Client(db);
          const method = (cachedClient as unknown as Record<string, Function>)[prop as string];
          if (typeof method === 'function') {
            return method.apply(cachedClient, args);
          }
          return method;
        });
      };
    },
  });
}

/**
 * Create D1 client from explicit binding (for use in middleware/edge).
 */
export function createClientFromBinding(db: D1Database): D1Client {
  return new D1Client(db);
}

// Re-export compatible types (no Supabase dependency needed)
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
