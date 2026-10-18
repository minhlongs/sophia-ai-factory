/**
 * Shared authentication, D1 binding, and ownership resolution for SOP listing lifecycle actions.
 * @module land/sop-marketplace/listing-lifecycle-context
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { success, failure, type Result } from '@/seed/types/result';
import {
  getSopListing as dbGetSopListing,
  getCreatorProfile as dbGetCreatorProfile,
  type SopListing,
  type CreatorProfile,
} from '@/seed/db/marketplace-ops';
import type { ListingError } from './listing-types';
import {
  CREATOR_MARKETPLACE_V2_ENABLED,
  marketplaceTemporarilyUnavailableError,
} from './availability';

export interface OwnedListingContext {
  userId: string;
  d1: NonNullable<Awaited<ReturnType<typeof getD1>>>;
  listing: SopListing;
  profile: CreatorProfile;
}

/**
 * Authenticates the caller, verifies marketplace availability, and ensures
 * the caller owns the target SOP listing.
 */
export async function loadOwnedListingContext(
  listingId: string,
): Promise<Result<OwnedListingContext, ListingError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
  }
  if (!CREATOR_MARKETPLACE_V2_ENABLED) {
    return failure(marketplaceTemporarilyUnavailableError());
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

  return success({ userId: user.id, d1, listing, profile });
}

export function validateDraftWithActiveProfile(
  listing: SopListing,
  profile: CreatorProfile,
  actionVerb: 'submit draft for review' | 'publish a draft listing',
  inactiveVerb: 'submit for review' | 'publish a listing',
): ListingError | null {
  if (listing.status !== 'draft') {
    return {
      code: 'INVALID_STATUS_TRANSITION',
      message: `Can only ${actionVerb}; current status is '${listing.status}'`,
    };
  }

  if (profile.status !== 'active') {
    return {
      code: 'PROFILE_NOT_ACTIVE',
      message: `Creator profile must be active to ${inactiveVerb}`,
    };
  }

  return null;
}
