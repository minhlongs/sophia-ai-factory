/**
 * SOP Creator Marketplace — SOP review database operations.
 *
 * Pure data access layer for SOP reviews. All functions accept
 * a D1Database binding explicitly rather than self-resolving,
 * enabling testability.
 *
 * @module seed/db/marketplace-reviews-ops
 */

import type { D1Database } from '@cloudflare/workers-types';
import { toError } from '@/seed/utils/to-error';
import type { CreateSopReviewInput, SopReview } from './marketplace-types';

// ── SOP Review Operations ──────────────────────────────────────────────────

/**
 * Create a review for an installed SOP.
 * Validates that the rating is between 1 and 5.
 * Returns the created review, or throws on failure.
 */
export async function createSopReview(
  db: D1Database,
  input: CreateSopReviewInput,
  tenantId?: string,
): Promise<SopReview> {
  if (input.rating < 1 || input.rating > 5) {
    throw new Error(`Rating must be between 1 and 5, got ${input.rating}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const resolvedTenantId = tenantId ?? 'default';

  const review: SopReview = {
    id,
    install_id: input.install_id,
    user_id: input.user_id,
    rating: input.rating,
    review_text: input.review_text ?? null,
    created_at: now,
  };

  try {
    const result = await db
      .prepare(
        `INSERT INTO sop_reviews (id, install_id, user_id, rating, review_text, created_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        review.id, review.install_id, review.user_id,
        review.rating, review.review_text, review.created_at,
        resolvedTenantId,
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create SOP review');
    }

    // Look up the listing_id for this install, then update average rating
    const installRow = await db
      .prepare('SELECT listing_id FROM sop_installs WHERE id = ?')
      .bind(input.install_id)
      .first<{ listing_id: string }>();

    if (installRow) {
      await db
        .prepare(
          `UPDATE sop_listings
           SET rating = (
             SELECT ROUND(AVG(r.rating), 1)
             FROM sop_reviews r
             JOIN sop_installs i ON r.install_id = i.id
             WHERE i.listing_id = ?
           )
           WHERE id = ?`,
        )
        .bind(installRow.listing_id, installRow.listing_id)
        .run();
    }

    return review;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * Get all reviews for a given SOP listing.
 * Joins through sop_installs to find reviews by listing.
 * Returns an empty array if no reviews exist.
 */
export async function getSopListingReviews(
  db: D1Database,
  listingId: string,
): Promise<SopReview[]> {
  try {
    const result = await db
      .prepare(
        `SELECT r.* FROM sop_reviews r
         JOIN sop_installs i ON r.install_id = i.id
         WHERE i.listing_id = ?
         ORDER BY r.created_at DESC`,
      )
      .bind(listingId)
      .all<SopReview>();

    return result.results ?? [];
  } catch (error) {
    throw toError(error);
  }
}
