/**
 * SOP Marketplace listing query helpers.
 * @module land/sop-marketplace/listing-queries
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { SopListing } from '@/seed/db/marketplace-ops';
import { getCreatorProfile as dbGetCreatorProfile } from '@/seed/db/marketplace-ops';
import { toView, type SopListingView, type ListingError } from './listing-types';
import {
  CREATOR_MARKETPLACE_V2_ENABLED,
  marketplaceTemporarilyUnavailableError,
} from './availability';

/**
 * List all SOP listings owned by the authenticated user.
 * Returns an empty array if the user is not a creator.
 */
export async function listMyListings(): Promise<Result<SopListingView[], ListingError>> {
  try {
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

    const profile = await dbGetCreatorProfile(d1, user.id, tenantId);
    if (!profile) {
      return success([]);
    }

    const result = await d1
      .prepare('SELECT * FROM sop_listings WHERE creator_id = ? ORDER BY created_at DESC')
      .bind(profile.id)
      .all<SopListing>();

    const listings = (result.results ?? []).map(toView);
    return success(listings);
  } catch (err) {
    logger.error('[ListMyListings] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
