/**
 * Shared types, interfaces, and helpers for SOP listing management.
 * @module land/sop-marketplace/listing-types
 */

import { z } from 'zod';
import type { SopListing } from '@/seed/db/marketplace-ops';

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
  status: 'draft' | 'published' | 'archived' | 'pending_review';
  installCount: number;
  rating: number;
  createdAt: number;
}

export type ListingErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NOT_CREATOR'
  | 'PROFILE_NOT_ACTIVE'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_STATUS_TRANSITION'
  | 'VALIDATION_ERROR'
  | 'DB_ERROR';

export interface ListingError {
  code: ListingErrorCode;
  message: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Format cents to a display price string. */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Safely parse a JSON string to string[] or return null. */
export function parseTags(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Map a DB SopListing (snake_case) to a public SopListingView (camelCase). */
export function toView(listing: SopListing): SopListingView {
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

// ── Validation Schemas ───────────────────────────────────────────────────

export const createListingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().min(0, 'Price must be non-negative'),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  demovideoUrl: z.string().url().optional().or(z.literal('')),
  sopTemplateId: z.string().min(1, 'SOP template ID is required'),
});

export const updateListingSchema = z.object({
  listingId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  priceCents: z.number().int().min(0).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['draft', 'published', 'archived', 'pending_review']).optional(),
});
