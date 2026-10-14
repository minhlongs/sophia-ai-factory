/**
 * Read Queries for SOP Creator Marketplace Listings.
 * @module seed/db/marketplace-listings-queries
 */

import type { D1Database } from '@cloudflare/workers-types';
import { toError } from '@/seed/utils/to-error';
import type { SopListing, ListingFilters } from './marketplace-types';

/**
 * Get a single SOP listing by its ID.
 * Returns the listing or null if not found.
 */
export async function getSopListing(
  db: D1Database,
  listingId: string,
): Promise<SopListing | null> {
  try {
    const row = await db
      .prepare('SELECT * FROM sop_listings WHERE id = ?')
      .bind(listingId)
      .first<SopListing>();

    return row ?? null;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * List SOP listings with optional category/status filtering.
 * Results are sorted by rating descending.
 * Returns an empty array if no listings match.
 */
export async function listSopListings(
  db: D1Database,
  filters?: ListingFilters,
  tenantId?: string,
): Promise<SopListing[]> {
  const resolvedTenantId = tenantId ?? 'default';

  try {
    const conditions: string[] = ['tenant_id = ?'];
    const values: unknown[] = [resolvedTenantId];

    if (filters?.category) {
      conditions.push('category = ?');
      values.push(filters.category);
    }
    if (filters?.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const sql = `SELECT * FROM sop_listings ${whereClause} ORDER BY rating DESC`;

    const result = await db.prepare(sql).bind(...values).all<SopListing>();

    return result.results ?? [];
  } catch (error) {
    throw toError(error);
  }
}
