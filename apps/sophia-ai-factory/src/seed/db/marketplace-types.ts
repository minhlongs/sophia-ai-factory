/**
 * SOP Creator Marketplace type definitions.
 *
 * Shared interfaces for creator profiles, SOP listings,
 * installs, and reviews.
 *
 * @module seed/db/marketplace-types
 */

// ── Creator Profile Types ─────────────────────────────────────────────────

export interface CreateCreatorProfileInput {
  user_id: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  payout_method?: 'nowpayments' | 'stripe_connect' | 'usdt' | null;
  payout_address?: string | null;
  status?: 'pending' | 'active' | 'suspended';
}

export interface CreatorProfile extends Required<CreateCreatorProfileInput> {
  id: string;
  total_earnings_cents: number;
  total_paid_cents: number;
  created_at: number;
  updated_at: number;
}

// ── SOP Listing Types ─────────────────────────────────────────────────────

export interface CreateSopListingInput {
  creator_id: string;
  title: string;
  description?: string | null;
  price_cents: number;
  category?: string | null;
  tags?: string | null;
  thumbnail_url?: string | null;
  demo_video_url?: string | null;
  sop_template_id: string;
  status?: 'draft' | 'published' | 'archived' | 'pending_review';
}

export interface SopListing extends Required<CreateSopListingInput> {
  id: string;
  install_count: number;
  rating: number;
  created_at: number;
  updated_at: number;
}

// ── SOP Install Types ─────────────────────────────────────────────────────

export interface CreateSopInstallInput {
  listing_id: string;
  user_id: string;
  license_id: string;
  price_cents: number;
  commission_id?: string | null;
}

export interface SopInstall {
  id: string;
  listing_id: string;
  user_id: string;
  license_id: string;
  price_cents: number;
  commission_id: string | null;
  status: 'active' | 'uninstalled';
  installed_at: number;
  uninstalled_at: number | null;
}

// ── SOP Review Types ──────────────────────────────────────────────────────

export interface CreateSopReviewInput {
  install_id: string;
  user_id: string;
  rating: number;
  review_text?: string | null;
}

export interface SopReview {
  id: string;
  install_id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  created_at: number;
}

// ── Shared Filter Types ───────────────────────────────────────────────────

export interface ListingFilters {
  category?: string;
  status?: 'draft' | 'published' | 'archived' | 'pending_review';
}
