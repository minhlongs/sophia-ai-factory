/**
 * Supabase browser client — replaced by D1 server-side architecture.
 *
 * Browser clients cannot access D1 directly. All data access must go
 * through /api/ routes which use the D1 server client.
 *
 * Legacy callers that used `supabase` singleton are now re-routed to
 * the D1 server client (works in Node/Worker contexts, not browser).
 */
import { createServerClient } from '@/seed/db/client';

/**
 * createClient() shim — throws a helpful error in browser context.
 * Server-side callers: import createClient from '@/lib/supabase/server' instead.
 */
export function createClient() {
  throw new Error(
    'Browser Supabase client replaced by D1. Use /api/ routes for client-side data access.'
  );
}

/**
 * `supabase` singleton shim for legacy server-side callers
 * (ingestion adapters, intelligence runner, campaign-service).
 * These run in Node/Worker context where D1 binding is available.
 */
export const supabase = new Proxy({} as ReturnType<typeof createServerClient>, {
  get(_target, prop) {
    return Reflect.get(createServerClient(), prop as string);
  },
});
