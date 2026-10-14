import type { D1Database } from '@cloudflare/workers-types';
import { D1Client } from '@/seed/db/d1-client-rpc';
import { toError } from '@/seed/utils/to-error';
import { getD1, getD1Sync } from './binding';

/**
 * Safe variant of createServerClient() — never throws.
 * Returns null when no D1 binding is available.
 */
export async function tryCreateServerClient(override?: D1Database): Promise<D1Client | null> {
  const db = override ?? (await getD1());
  if (!db) return null;
  return new D1Client(db);
}

/**
 * Synchronous variant of tryCreateServerClient() — never throws.
 * Returns null when no D1 binding is available.
 */
export function tryCreateServerClientSync(override?: D1Database): D1Client | null {
  let db: D1Database | null;
  try {
    db = override ?? getD1Sync();
  } catch {
    return null;
  }
  if (!db) return null;
  return new D1Client(db);
}

/**
 * Create a server-side D1 client.
 * Drop-in replacement for Supabase createServerClient().
 * @throws Error if no D1 binding is available
 */
export function createServerClient(override?: D1Database): D1Client {
  const db = override ?? getD1Sync();
  if (!db) throw new Error('D1 database binding not available');

  return new D1Client(db);
}

/**
 * @deprecated Use createServerClient() instead.
 */
export async function getD1Client(override?: D1Database): Promise<D1Client> {
  const db = override ?? (await getD1());
  if (!db) throw new Error('D1 database binding not available');
  return new D1Client(db);
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
