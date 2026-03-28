/**
 * Supabase admin client — compatibility shim backed by D1.
 *
 * All callers of `createAdminClient()` and `isAdminClientConfigured()`
 * continue to work unchanged. D1 has no concept of service-role vs anon —
 * the same D1Client is returned for all server-side operations.
 */
import { getD1Client } from '@/lib/db/client';

/**
 * Returns a D1Client with the same query API as the Supabase admin client.
 * Async because D1 binding resolution may be async on first call.
 */
export async function createAdminClient() {
  return getD1Client();
}

/**
 * Always returns true — D1 binding is always available in CF Workers context.
 * Replaces the old Supabase credential presence check.
 */
export function isAdminClientConfigured(): boolean {
  return true;
}

/**
 * Alias kept for any callers that use the old `isSupabaseConfigured` name.
 */
export const isSupabaseConfigured = isAdminClientConfigured;
