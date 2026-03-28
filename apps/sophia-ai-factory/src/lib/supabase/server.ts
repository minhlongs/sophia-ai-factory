/**
 * Supabase server client — compatibility shim backed by D1.
 *
 * All imports of `createClient` or `createServerClient` from this file
 * now resolve to the D1-backed implementation. No changes needed in callers.
 */
export { createServerClient } from '@/lib/db/client';

// Some callers import `createClient` (e.g. src/app/auth/callback/route.ts)
export { createServerClient as createClient } from '@/lib/db/client';
