/**
 * SOP Marketplace Guard — Fail-closed access control and financial integrity.
 *
 * Enforces policy:
 * - Paid marketplace listings (price_cents > 0) are blocked from install and execution until verified checkout is live.
 * - Invalid price values (null, negative, non-integer) are rejected fail-closed.
 * - Official templates and valid free marketplace listings (price_cents === 0) are permitted.
 * - Handles both schema 0126 (template_id) and 0213 (sop_template_id) safely.
 *
 * @module seed/sop/sop-marketplace-guard
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';

export interface GuardError {
  code: 'PAYMENT_REQUIRED' | 'DB_ERROR' | 'FORBIDDEN';
  message: string;
}

interface ListingRow {
  id: string;
  price_cents: number | null | undefined;
  status?: string | null;
}

/**
 * Check if a template is tied to a paid or invalid marketplace listing.
 * Throws GuardError if the template cannot be installed.
 */
export async function assertTemplateInstallable(
  db: D1Database,
  templateId: string,
): Promise<void> {
  const listing = await findMarketplaceListing(db, templateId);
  if (!listing) {
    // Official template or unlisted free template: permitted
    return;
  }

  // Marketplace listings must be explicitly published to be installable
  if (listing.status !== 'published') {
    logger.warn('[SopMarketplaceGuard] Install blocked: listing not published', {
      templateId,
      listingId: listing.id,
      status: listing.status,
    });
    const err = new Error('Marketplace SOP is not published.');
    (err as unknown as { code: string }).code = 'FORBIDDEN';
    throw err;
  }

  // Validate price integrity: strictly price_cents === 0
  const price = listing.price_cents;
  const isFree =
    typeof price === 'number' &&
    Number.isInteger(price) &&
    price === 0;

  if (!isFree) {
    logger.warn('[SopMarketplaceGuard] Install blocked: paid or invalid price', {
      templateId,
      listingId: listing.id,
      price,
    });
    const err = new Error('Paid marketplace SOPs cannot be installed until checkout is enabled.');
    (err as unknown as { code: string }).code = 'PAYMENT_REQUIRED';
    throw err;
  }
}

/**
 * Check if an installation/template can be executed.
 * Fails closed if the template is associated with a paid listing without verified payment
 * or if the listing is not in published status.
 */
export async function assertTemplateExecutable(
  db: D1Database,
  templateId: string,
): Promise<void> {
  const listing = await findMarketplaceListing(db, templateId);
  if (!listing) {
    // Official template or unlisted free template: permitted
    return;
  }

  // Marketplace listings must be explicitly published to be executable
  if (listing.status !== 'published') {
    logger.warn('[SopMarketplaceGuard] Run blocked: listing not published', {
      templateId,
      listingId: listing.id,
      status: listing.status,
    });
    const err = new Error('Marketplace SOP is not published.');
    (err as unknown as { code: string }).code = 'FORBIDDEN';
    throw err;
  }

  const price = listing.price_cents;
  const isFree =
    typeof price === 'number' &&
    Number.isInteger(price) &&
    price === 0;

  if (!isFree) {
    logger.warn('[SopMarketplaceGuard] Run blocked: paid template without verified payment', {
      templateId,
      listingId: listing.id,
      price,
    });
    const err = new Error('Paid marketplace SOPs cannot be executed until checkout is enabled.');
    (err as unknown as { code: string }).code = 'PAYMENT_REQUIRED';
    throw err;
  }
}

/**
 * Query sop_listings safely against both migration 0126 (template_id)
 * and migration 0213 (sop_template_id).
 *
 * Fails closed with DB_ERROR if queries fail on both schemas.
 */
async function findMarketplaceListing(
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
