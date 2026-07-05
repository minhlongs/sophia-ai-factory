/**
 * SOP Listing Manager Server Actions
 *
 * 'use server' module for SOP listing CRUD — create, update, publish,
 * archive, and list the current user's own listings.
 *
 * @module land/sop-marketplace/listing-manager
 */

'use server';

import { z } from 'zod';
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

// ── Public Types ─────────────────────────────────────────────────────────

export interface SopListingView {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  priceCents: number;
  priceDisplay: string;
  category: string | null;
  tags: string[] | null;
  thumbnailUrl: string | null;
  demovideoUrl: string | null;
  sopTemplateId: string;
  status: 'draft' | 'published' | 'archived';
  installCount: number;
  rating: number;
  createdAt: number;
}

type ListingErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NOT_CREATOR'
  | 'PROFILE_NOT_ACTIVE'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_STATUS_TRANSITION'
  | 'VALIDATION_ERROR'
  | 'DB_ERROR';

interface ListingError {
  code: ListingErrorCode;
  message: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Format cents to a display price string. */
function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Safely parse a JSON string to string[] or return null. */
function parseTags(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Map a DB SopListing (snake_case) to a public SopListingView (camelCase). */
function toView(listing: SopListing): SopListingView {
  return {
    id: listing.id,
    creatorId: listing.creator_id,
    title: listing.title,
    description: listing.description,
    priceCents: listing.price_cents,
    priceDisplay: formatPrice(listing.price_cents),
    category: listing.category,
    tags: parseTags(listing.tags),
    thumbnailUrl: listing.thumbnail_url,
    demovideoUrl: listing.demo_video_url,
    sopTemplateId: listing.sop_template_id,
    status: listing.status,
    installCount: listing.install_count,
    rating: listing.rating,
    createdAt: listing.created_at,
  };
}

// ── Validation Schemas ──────────────────────────────────────────────────

const createListingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().min(0, 'Price must be non-negative'),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  demovideoUrl: z.string().url().optional().or(z.literal('')),
  sopTemplateId: z.string().min(1, 'SOP template ID is required'),
});

const updateListingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().min(0).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

// ── Actions ─────────────────────────────────────────────────────────────

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
    // Auth gate
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    // Validate input
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

    // Resolve tenant from org membership
    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';

    // Verify creator profile exists
    const profile = await dbGetCreatorProfile(d1, user.id, tenantId);
    if (!profile) {
      return failure({
        code: 'NOT_CREATOR',
        message: 'You must register as a creator before creating listings',
      });
    }

    // Build DB input
    const dbInput: CreateSopListingInput = {
      creator_id: profile.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      price_cents: parsed.data.priceCents,
      category: parsed.data.category ?? null,
      tags: parsed.data.tags ? JSON.stringify(parsed.data.tags) : null,
      thumbnail_url: parsed.data.thumbnailUrl?.trim() || null,
      demo_video_url: parsed.data.demovideoUrl?.trim() || null,
      sop_template_id: parsed.data.sopTemplateId,
      status: 'draft',
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
    status: 'draft' | 'published' | 'archived';
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

    // Resolve tenant from org membership
    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';

    // Fetch listing and verify ownership
    const listing = await dbGetSopListing(d1, listingId);
    if (!listing) {
      return failure({ code: 'NOT_FOUND', message: 'Listing not found' });
    }

    const profile = await dbGetCreatorProfile(d1, user.id, tenantId);
    if (!profile || listing.creator_id !== profile.id) {
      return failure({ code: 'FORBIDDEN', message: 'You do not own this listing' });
    }

    // Build update payload
    const updateInput: Partial<CreateSopListingInput> = {};

    if (parsed.data.title !== undefined) {
      updateInput.title = parsed.data.title;
    }
    if (parsed.data.description !== undefined) {
      updateInput.description = parsed.data.description || null;
    }
    if (parsed.data.priceCents !== undefined) {
      updateInput.price_cents = parsed.data.priceCents;
    }
    if (parsed.data.category !== undefined) {
      updateInput.category = parsed.data.category || null;
    }
    if (parsed.data.tags !== undefined) {
      updateInput.tags = parsed.data.tags.length > 0 ? JSON.stringify(parsed.data.tags) : null;
    }
    if (parsed.data.thumbnailUrl !== undefined) {
      updateInput.thumbnail_url = parsed.data.thumbnailUrl?.trim() || null;
    }

    // Validate status transitions if provided
    if (parsed.data.status !== undefined) {
      const currentStatus = listing.status;
      const newStatus = parsed.data.status;

      if (currentStatus !== newStatus) {
        // Allowed: draft -> published | draft -> archived | published -> archived
        // Blocked: published -> draft | archived -> draft | archived -> published
        const allowedFromDraft: Set<string> = new Set(['published', 'archived']);
        const allowedFromPublished: Set<string> = new Set(['archived']);

        const isValid =
          (currentStatus === 'draft' && allowedFromDraft.has(newStatus)) ||
          (currentStatus === 'published' && allowedFromPublished.has(newStatus));

        if (!isValid) {
          return failure({
            code: 'INVALID_STATUS_TRANSITION',
            message: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
          });
        }

        // When publishing from draft, verify the creator profile is active
        if (currentStatus === 'draft' && newStatus === 'published' && profile.status !== 'active') {
          return failure({
            code: 'PROFILE_NOT_ACTIVE',
            message: 'Creator profile must be active to publish a listing',
          });
        }
      }

      updateInput.status = newStatus;
    }

    const updated = await dbUpdateSopListing(d1, listingId, updateInput);
    if (!updated) {
      return failure({ code: 'DB_ERROR', message: 'Failed to update listing' });
    }

    logger.info('[UpdateSopListing] Listing updated', { userId: user.id, listingId });

    return success({ listingId: updated.id });
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

    // Resolve tenant from org membership
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

/**
 * Publish a draft listing — makes it visible in the marketplace.
 * Requires the creator profile to be active.
 */
export async function publishListing(
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

    // Resolve tenant from org membership
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

    const d1 = getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Resolve tenant from org membership
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
