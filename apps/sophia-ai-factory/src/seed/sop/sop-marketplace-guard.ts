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
import { findMarketplaceListing } from './sop-marketplace-listing-query';

export interface GuardError {
  code: 'PAYMENT_REQUIRED' | 'DB_ERROR' | 'FORBIDDEN';
  message: string;
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
