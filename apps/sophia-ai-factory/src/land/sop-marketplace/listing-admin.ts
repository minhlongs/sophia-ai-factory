/**
 * SOP Listing admin actions: approve and reject pending listings.
 * @module land/sop-marketplace/listing-admin
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import {
  getSopListing as dbGetSopListing,
  updateSopListing as dbUpdateSopListing,
} from '@/seed/db/marketplace-ops';
import type { ListingError } from './listing-types';

/**
 * Admin: Approve a pending review listing — sets status to 'published'.
 */
export async function approveListingAdmin(
  listingId: string,
): Promise<Result<{ listingId: string }, ListingError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const listing = await dbGetSopListing(d1, listingId);
    if (!listing) {
      return failure({ code: 'NOT_FOUND', message: 'Listing not found' });
    }

    if (listing.status !== 'pending_review') {
      return failure({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Can only approve pending_review listings; current status is '${listing.status}'`,
      });
    }

    await dbUpdateSopListing(d1, listingId, { status: 'published' });

    logger.info('[ApproveListingAdmin] Listing approved by admin', { adminId: user.id, listingId });

    return success({ listingId });
  } catch (err) {
    logger.error('[ApproveListingAdmin] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}

/**
 * Admin: Reject a pending review listing — sets status back to 'draft'.
 */
export async function rejectListingAdmin(
  listingId: string,
  reason: string,
): Promise<Result<{ listingId: string }, ListingError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const listing = await dbGetSopListing(d1, listingId);
    if (!listing) {
      return failure({ code: 'NOT_FOUND', message: 'Listing not found' });
    }

    if (listing.status !== 'pending_review') {
      return failure({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Can only reject pending_review listings; current status is '${listing.status}'`,
      });
    }

    await dbUpdateSopListing(d1, listingId, { status: 'draft' });

    logger.info('[RejectListingAdmin] Listing rejected by admin', { adminId: user.id, listingId, reason });

    return success({ listingId });
  } catch (err) {
    logger.error('[RejectListingAdmin] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
