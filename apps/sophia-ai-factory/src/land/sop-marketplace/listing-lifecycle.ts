/**
 * SOP Listing lifecycle actions: submit for review, publish, archive.
 * @module land/sop-marketplace/listing-lifecycle
 */

'use server';

import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import { updateSopListing as dbUpdateSopListing } from '@/seed/db/marketplace-ops';
import type { ListingError } from './listing-types';
import {
  loadOwnedListingContext,
  validateDraftWithActiveProfile,
} from './listing-lifecycle-context';

/**
 * Submit a draft listing for admin review.
 * Sets status to 'pending_review' (NOT 'published').
 * Creator must have an active profile.
 */
export async function submitForReview(
  listingId: string,
): Promise<Result<{ listingId: string }, ListingError>> {
  try {
    const ctxResult = await loadOwnedListingContext(listingId);
    if (!ctxResult.ok) return ctxResult;
    const { userId, d1, listing, profile } = ctxResult.value;

    const validationErr = validateDraftWithActiveProfile(
      listing,
      profile,
      'submit draft for review',
      'submit for review',
    );
    if (validationErr) return failure(validationErr);

    await dbUpdateSopListing(d1, listingId, { status: 'pending_review' });
    logger.info('[SubmitForReview] Listing submitted for review', { userId, listingId });
    return success({ listingId });
  } catch (err) {
    logger.error('[SubmitForReview] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}

/**
 * Publish a draft listing — makes it visible in the marketplace.
 * Requires the creator profile to be active.
 * NOTE: This now requires admin approval via pending_review.
 * Creator-facing apps should use submitForReview() instead.
 */
export async function publishListing(
  listingId: string,
): Promise<Result<{ listingId: string }, ListingError>> {
  try {
    const ctxResult = await loadOwnedListingContext(listingId);
    if (!ctxResult.ok) return ctxResult;
    const { userId, d1, listing, profile } = ctxResult.value;

    const validationErr = validateDraftWithActiveProfile(
      listing,
      profile,
      'publish a draft listing',
      'publish a listing',
    );
    if (validationErr) return failure(validationErr);

    if (listing.price_cents > 0) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'Paid listings cannot be published until checkout is enabled. Please keep as draft or set price to 0.',
      });
    }

    await dbUpdateSopListing(d1, listingId, { status: 'published' });
    logger.info('[PublishListing] Listing published', { userId, listingId });
    return success({ listingId });
  } catch (err) {
    logger.error('[PublishListing] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}

/**
 * Archive a published listing — removes it from the marketplace.
 * Draft listings should be deleted instead; this action blocks archiving drafts.
 */
export async function archiveListing(
  listingId: string,
): Promise<Result<{ listingId: string }, ListingError>> {
  try {
    const ctxResult = await loadOwnedListingContext(listingId);
    if (!ctxResult.ok) return ctxResult;
    const { userId, d1, listing } = ctxResult.value;

    if (listing.status === 'archived') {
      return failure({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Listing is already archived',
      });
    }

    if (listing.status === 'draft') {
      return failure({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Cannot archive a draft listing; delete it instead',
      });
    }

    await dbUpdateSopListing(d1, listingId, { status: 'archived' });
    logger.info('[ArchiveListing] Listing archived', { userId, listingId });
    return success({ listingId });
  } catch (err) {
    logger.error('[ArchiveListing] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
