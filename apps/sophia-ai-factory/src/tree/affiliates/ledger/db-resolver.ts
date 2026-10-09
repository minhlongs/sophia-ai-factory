/**
 * Affiliate Ledger Submodule: D1 Database Resolver.
 * Layer: tree (domain reusable; imports from @/seed)
 *
 * @module tree/affiliates/ledger/db-resolver
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Resolves the active Cloudflare D1 database.
 */
export async function resolveD1(customD1?: D1Database): Promise<D1Database | null> {
  if (customD1) return customD1;
  try {
    return await getD1Raw();
  } catch (err) {
    logger.warn('[AffiliateLedgerService] Failed to resolve D1 database', { error: String(err) });
    return null;
  }
}
