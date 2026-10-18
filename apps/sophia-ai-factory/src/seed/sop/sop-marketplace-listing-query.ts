/**
 * SOP Marketplace Listing Query Helper
 *
 * Queries sop_listings safely across migration 0126 (template_id) and 0213 (sop_template_id).
 *
 * @module seed/sop/sop-marketplace-listing-query
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';

export interface ListingRow {
  id: string;
  price_cents: number | null | undefined;
  status?: string | null;
}

/**
 * Query sop_listings safely against both migration 0126 (template_id)
 * and migration 0213 (sop_template_id).
 *
 * Fails closed with DB_ERROR if queries fail on both schemas.
 */
export async function findMarketplaceListing(
  db: D1Database,
  templateId: string,
): Promise<ListingRow | null> {
  let querySucceeded = false;
  let lastError: unknown = null;

  // Try migration 0213 schema (sop_template_id)
  try {
    const row0213 = await db
      .prepare(`SELECT id, price_cents, status FROM sop_listings WHERE sop_template_id = ?1 LIMIT 1`)
      .bind(templateId)
      .first<ListingRow>();

    querySucceeded = true;
    if (row0213) return row0213;
  } catch (err) {
    lastError = err;
  }

  // Try migration 0126 schema (template_id)
  try {
    const row0126 = await db
      .prepare(`SELECT id, price_cents, status FROM sop_listings WHERE template_id = ?1 LIMIT 1`)
      .bind(templateId)
      .first<ListingRow>();

    querySucceeded = true;
    if (row0126) return row0126;
  } catch (err) {
    lastError = err;
  }

  if (!querySucceeded) {
    logger.error('[SopMarketplaceGuard] Failed to query marketplace listings on all schemas', {
      templateId,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    });
    const err = new Error('Database query failed for marketplace listings: unable to verify template status.');
    (err as unknown as { code: string }).code = 'DB_ERROR';
    throw err;
  }

  return null;
}
