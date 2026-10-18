/**
 * SOP Creator Marketplace — SOP listing database operations.
 *
 * Pure data access layer for SOP listings. All functions accept
 * a D1Database binding explicitly rather than self-resolving,
 * enabling testability.
 *
 * @module seed/db/marketplace-listings-ops
 */

import type { D1Database } from '@cloudflare/workers-types';
import { toError } from '@/seed/utils/to-error';
import type { CreateSopListingInput, SopListing } from './marketplace-types';

export { getSopListing, listSopListings } from './marketplace-listings-queries';
export { updateSopListing } from './marketplace-listings-update';

/**
 * Create a new SOP listing.
 * Returns the created listing, or throws on failure.
 */
export async function createSopListing(
  db: D1Database,
  input: CreateSopListingInput,
  tenantId?: string,
): Promise<SopListing> {
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const resolvedTenantId = tenantId ?? 'default';

  const listing: SopListing = {
    id,
    creator_id: input.creator_id,
    title: input.title,
    description: input.description ?? null,
    price_cents: input.price_cents,
    category: input.category ?? null,
    tags: input.tags ?? null,
    thumbnail_url: input.thumbnail_url ?? null,
    demo_video_url: input.demo_video_url ?? null,
    sop_template_id: input.sop_template_id,
    status: input.status ?? 'draft',
    install_count: 0,
    rating: 0,
    created_at: now,
    updated_at: now,
  };

  try {
    const result = await db
      .prepare(
        `INSERT INTO sop_listings
         (id, creator_id, title, description, price_cents, category,
          tags, thumbnail_url, demo_video_url, sop_template_id,
          status, install_count, rating, created_at, updated_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        listing.id, listing.creator_id, listing.title, listing.description,
        listing.price_cents, listing.category, listing.tags,
        listing.thumbnail_url, listing.demo_video_url, listing.sop_template_id,
        listing.status, listing.install_count, listing.rating,
        listing.created_at, listing.updated_at, resolvedTenantId,
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create SOP listing');
    }

    return listing;
  } catch (error) {
    throw toError(error);
  }
}
