/**
 * SOP Listing lifecycle actions: submit for review, publish, archive.
 * @module land/sop-marketplace/listing-lifecycle
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import {
  getSopListing as dbGetSopListing,
  updateSopListing as dbUpdateSopListing,
  getCreatorProfile as dbGetCreatorProfile,
} from '@/seed/db/marketplace-ops';
import type { ListingError } from './listing-types';

/**
 * Submit a draft listing for admin review.
 * Sets status to 'pending_review' (NOT 'published').
 * Creator must have an active profile.
 */
export async function submitForReview(
  listingId: string,
): Promise<Result<{ listingId: string }, ListingError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';

    const listing = await dbGetSopListing(d1, listingId);
    if (!listing) {
      return failure({ code: 'NOT_FOUND', message: 'Listing not found' });
    }

    const profile = await dbGetCreatorProfile(d1, user.id, tenantId);
    if (!profile || listing.creator_id !== profile.id) {
      return failure({ code: 'FORBIDDEN', message: 'You do not own this listing' });
    }

    if (listing.status !== 'draft') {
      return failure({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Can only submit draft for review; current status is '${listing.status}'`,
      });
    }

    if (profile.status !== 'active') {
      return failure({
        code: 'PROFILE_NOT_ACTIVE',
        message: 'Creator profile must be active to submit for review',
      });
    }

    await dbUpdateSopListing(d1, listingId, { status: 'pending_review' });

    logger.info('[SubmitForReview] Listing submitted for review', { userId: user.id, listingId });

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
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';

    const listing = await dbGetSopListing(d1, listingId);
    if (!listing) {
      return failure({ code: 'NOT_FOUND', message: 'Listing not found' });
    }

    const profile = await dbGetCreatorProfile(d1, user.id, tenantId);
    if (!profile || listing.creator_id !== profile.id) {
      return failure({ code: 'FORBIDDEN', message: 'You do not own this listing' });
    }

    if (listing.status !== 'draft') {
      return failure({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Can only publish a draft listing; current status is '${listing.status}'`,
      });
    }

    if (profile.status !== 'active') {
      return failure({
        code: 'PROFILE_NOT_ACTIVE',
        message: 'Creator profile must be active to publish a listing',
      });
    }

    await dbUpdateSopListing(d1, listingId, { status: 'published' });

    logger.info('[PublishListing] Listing published', { userId: user.id, listingId });

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
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';

    const listing = await dbGetSopListing(d1, listingId);
    if (!listing) {
      return failure({ code: 'NOT_FOUND', message: 'Listing not found' });
    }

    const profile = await dbGetCreatorProfile(d1, user.id, tenantId);
    if (!profile || listing.creator_id !== profile.id) {
      return failure({ code: 'FORBIDDEN', message: 'You do not own this listing' });
    }

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

    logger.info('[ArchiveListing] Listing archived', { userId: user.id, listingId });

    return success({ listingId });
  } catch (err) {
    logger.error('[ArchiveListing] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
