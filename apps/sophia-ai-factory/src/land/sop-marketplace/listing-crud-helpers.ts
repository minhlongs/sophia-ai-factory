/**
 * SOP Listing CRUD payload builders, auth context, and D1 execution helpers.
 * @module land/sop-marketplace/listing-crud-helpers
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { failure, success, type Result } from '@/seed/types/result';
import type { CreateSopListingInput, SopListing } from '@/seed/db/marketplace-ops';
import {
  getSopListing as dbGetSopListing,
  getCreatorProfile as dbGetCreatorProfile,
} from '@/seed/db/marketplace-ops';
import type { ListingError } from './listing-types';
import {
  CREATOR_MARKETPLACE_V2_ENABLED,
  marketplaceTemporarilyUnavailableError,
} from './availability';

export type MarketplaceD1 = NonNullable<Awaited<ReturnType<typeof getD1>>>;

export interface AuthenticatedMarketplaceContext {
  userId: string;
  d1: MarketplaceD1;
  tenantId: string;
}

export async function requireAuthenticatedMarketplaceContext(): Promise<
  Result<AuthenticatedMarketplaceContext, ListingError>
> {
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

  return success({ userId: user.id, d1, tenantId });
}

export function buildCreateSopListingDbInput(
  userId: string,
  data: {
    title: string;
    description?: string;
    priceCents: number;
    category?: string;
    tags?: string[];
    thumbnailUrl?: string;
    demovideoUrl?: string;
    sopTemplateId: string;
  },
): CreateSopListingInput {
  return {
    creator_id: userId,
    title: data.title,
    description: data.description ?? null,
    price_cents: data.priceCents,
    category: data.category ?? null,
    tags: data.tags ? JSON.stringify(data.tags) : null,
    thumbnail_url: data.thumbnailUrl || null,
    demo_video_url: data.demovideoUrl || null,
    sop_template_id: data.sopTemplateId,
  };
}

export async function verifyListingOwnership(
  d1: MarketplaceD1,
  userId: string,
  tenantId: string,
  listingId: string,
): Promise<Result<SopListing, ListingError>> {
  const listing = await dbGetSopListing(d1, listingId);
  if (!listing) {
    return failure({ code: 'NOT_FOUND', message: 'Listing not found' });
  }

  const profile = await dbGetCreatorProfile(d1, userId, tenantId);
  if (!profile || listing.creator_id !== profile.id) {
    return failure({ code: 'FORBIDDEN', message: 'You do not own this listing' });
  }

  return success(listing);
}

export function buildAndValidateListingUpdates(
  parsedData: {
    title?: string;
    priceCents?: number;
    status?: 'draft' | 'published' | 'archived' | 'pending_review';
  },
  existingListing: SopListing,
): Result<Record<string, unknown>, ListingError> {
  const updates: Record<string, unknown> = {};
  if (parsedData.title !== undefined) updates.title = parsedData.title;
  if (parsedData.priceCents !== undefined) updates.price_cents = parsedData.priceCents;
  if (parsedData.status !== undefined) updates.status = parsedData.status;

  const effectivePrice =
    parsedData.priceCents !== undefined ? parsedData.priceCents : existingListing.price_cents;
  const effectiveStatus =
    parsedData.status !== undefined ? parsedData.status : existingListing.status;

  if (effectiveStatus === 'published' && effectivePrice > 0) {
    return failure({
      code: 'VALIDATION_ERROR',
      message:
        'Paid listings cannot be published until checkout is enabled. Please keep as draft or set price to 0.',
    });
  }

  return success(updates);
}
