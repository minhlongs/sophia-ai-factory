/**
 * D1 Database Client — drop-in replacement for Supabase client
 *
 * Backward-compatible root facade re-exporting from client/index.
 *
 * @module seed/db/client
 */

import type { D1Database } from '@cloudflare/workers-types';
export type { D1Database };
export { D1Client } from '@/seed/db/d1-client-rpc';
export { withD1Retry, isD1TransientError } from '@/seed/db/d1-retry';

export * from './client/index';
