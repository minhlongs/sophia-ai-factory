/**
 * D1 admin client — drop-in replacement for the deleted Supabase admin shim.
 *
 * All callers of `createAdminClient()` and `isAdminClientConfigured()`
 * continue to work unchanged. Returns a D1Client backed by the
 * Cloudflare D1 binding instead of a Supabase service-role client.
 */

import { createServerClient } from '@/seed/db/client';
import type { D1Client } from '@/seed/db/d1-query-builder';

/**
 * Returns a D1Client with the same query API as the Supabase admin client.
 * Async because D1 binding resolution may be async on first call.
 */
export async function createAdminClient(): Promise<D1Client> {
  return createServerClient();
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
