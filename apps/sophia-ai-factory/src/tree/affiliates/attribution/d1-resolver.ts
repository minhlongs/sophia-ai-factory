/**
 * D1 Database Resolver for Affiliate Attribution
 * Layer: tree (domain business logic, edge-compatible)
 *
 * @module tree/affiliates/attribution/d1-resolver
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Resolves Cloudflare D1 database instance.
 */
export async function resolveD1(customD1?: D1Database): Promise<D1Database | null> {
  if (customD1) return customD1;
  try {
    return await getD1Raw();
  } catch (err) {
    logger.warn('[AffiliateAttribution] Failed to resolve D1 database', { error: String(err) });
    return null;
  }
}
