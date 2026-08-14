/**
 * SOP Listing CRUD actions: create, update, list user's own listings.
 * @module land/sop-marketplace/listing-crud
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { CreateSopListingInput, SopListing } from '@/seed/db/marketplace-ops';
import {
  createSopListing as dbCreateSopListing,
  getSopListing as dbGetSopListing,
  updateSopListing as dbUpdateSopListing,
  getCreatorProfile as dbGetCreatorProfile,
} from '@/seed/db/marketplace-ops';
import { toView, createListingSchema, updateListingSchema, type SopListingView, type ListingError } from './listing-types';

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
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const parsed = createListingSchema.safeParse(formData);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const d1 = getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';

    const profile = await dbGetCreatorProfile(d1, user.id, tenantId);
    if (!profile) {
      return failure({
        code: 'NOT_FOUND',
        message: 'Creator profile not found. Please create a profile first.',
      });
    }

    const dbInput: CreateSopListingInput = {
      creator_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      price_cents: parsed.data.priceCents,
      category: parsed.data.category ?? null,
      tags: parsed.data.tags ? JSON.stringify(parsed.data.tags) : null,
      thumbnail_url: parsed.data.thumbnailUrl || null,
      demo_video_url: parsed.data.demovideoUrl || null,
      sop_template_id: parsed.data.sopTemplateId,
    };

    const listing = await dbCreateSopListing(d1, dbInput, tenantId);

    logger.info('[CreateSopListing] Listing created', {
      userId: user.id,
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
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const parsed = updateListingSchema.safeParse(formData);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const d1 = getD1();
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

    const updates: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.priceCents !== undefined) updates.price_cents = parsed.data.priceCents;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;

    if (Object.keys(updates).length === 0) {
      return success({ listingId });
    }

    const updated = await dbUpdateSopListing(d1, listingId, updates);

    logger.info('[UpdateSopListing] Listing updated', { userId: user.id, listingId });
    return success({ listingId: updated?.id ?? listingId });
  } catch (err) {
    logger.error('[UpdateSopListing] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}

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

    const d1 = getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';

    const profile = await dbGetCreatorProfile(d1, user.id, tenantId);
    if (!profile) {
      // Not a creator — return empty list rather than error
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
