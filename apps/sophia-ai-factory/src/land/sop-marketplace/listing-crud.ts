/**
 * SOP Listing CRUD actions: create, update, list user's own listings.
 * @module land/sop-marketplace/listing-crud
 */

'use server';

import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import {
  createSopListing as dbCreateSopListing,
  updateSopListing as dbUpdateSopListing,
  getCreatorProfile as dbGetCreatorProfile,
} from '@/seed/db/marketplace-ops';
import { createListingSchema, updateListingSchema, type ListingError, type SopListingView } from './listing-types';
import {
  buildAndValidateListingUpdates,
  buildCreateSopListingDbInput,
  requireAuthenticatedMarketplaceContext,
  verifyListingOwnership,
} from './listing-crud-helpers';
import { listMyListings as queryListMyListings } from './listing-queries';

export async function listMyListings(): Promise<Result<SopListingView[], ListingError>> {
  return queryListMyListings();
}

/**
 * Create a new SOP listing in draft status.
 * Requires the user to have an existing creator profile.
 */
export async function createSopListing(formData: {
  title: string;
  description?: string;
  priceCents: number;
  category?: string;
  tags?: string[];
  thumbnailUrl?: string;
  demovideoUrl?: string;
  sopTemplateId: string;
}): Promise<Result<{ listingId: string }, ListingError>> {
  try {
    const ctxResult = await requireAuthenticatedMarketplaceContext();
    if (!ctxResult.ok) return ctxResult;
    const { userId, d1, tenantId } = ctxResult.value;

    const parsed = createListingSchema.safeParse(formData);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const profile = await dbGetCreatorProfile(d1, userId, tenantId);
    if (!profile) {
      return failure({
        code: 'NOT_FOUND',
        message: 'Creator profile not found. Please create a profile first.',
      });
    }

    const dbInput = buildCreateSopListingDbInput(userId, parsed.data);
    const listing = await dbCreateSopListing(d1, dbInput, tenantId);

    logger.info('[CreateSopListing] Listing created', {
      userId,
      listingId: listing.id,
      creatorId: profile.id,
      tenantId,
    });

    return success({ listingId: listing.id });
  } catch (err) {
    logger.error('[CreateSopListing] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}

/**
 * Update an existing SOP listing.
 * Only the authenticated owner of the listing may update it.
 */
export async function updateSopListing(
  listingId: string,
  formData: Partial<{
    title: string;
    description: string;
    priceCents: number;
    category: string;
    tags: string[];
    thumbnailUrl: string;
    demovideoUrl: string;
    status: 'draft' | 'published' | 'archived' | 'pending_review';
  }>,
): Promise<Result<{ listingId: string }, ListingError>> {
  try {
    const ctxResult = await requireAuthenticatedMarketplaceContext();
    if (!ctxResult.ok) return ctxResult;
    const { userId, d1, tenantId } = ctxResult.value;

    const parsed = updateListingSchema.safeParse({ listingId, ...formData });
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const listingResult = await verifyListingOwnership(d1, userId, tenantId, listingId);
    if (!listingResult.ok) return listingResult;

    const updatesResult = buildAndValidateListingUpdates(parsed.data, listingResult.value);
    if (!updatesResult.ok) return updatesResult;

    if (Object.keys(updatesResult.value).length === 0) {
      return success({ listingId });
    }

    const updated = await dbUpdateSopListing(d1, listingId, updatesResult.value);

    logger.info('[UpdateSopListing] Listing updated', { userId, listingId });
    return success({ listingId: updated?.id ?? listingId });
  } catch (err) {
    logger.error('[UpdateSopListing] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
