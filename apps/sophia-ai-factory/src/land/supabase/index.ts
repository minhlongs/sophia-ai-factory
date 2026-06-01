/**
 * @module supabase
 * Barrel re-exports.
 *
 * Note: createClient is exported from both client.ts (browser shim) and
 * server.ts (re-export of createServerClient). The server version is canonical.
 * OverageEventRow is excluded — billing/billing-types is the canonical source.
 */
export * from './admin';
// client excluded from wildcard — createClient clashes with server.ts
export { createClient as createBrowserClient, supabase } from './client';
export * from './server';
export * from './sophia-index';
// types excluded from wildcard — OverageEventRow clashes with billing/billing-types
// Import specific types directly: import type { Database } from '@/land/supabase/types'
export type { Database, Json } from './types';
