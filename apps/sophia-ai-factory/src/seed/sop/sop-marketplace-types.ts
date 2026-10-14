/**
 * SOP Marketplace & Challenge Types
 *
 * Row and input types for sop_listings, sop_licenses, sop_challenges and
 * user_challenge_progress. All snake_case from DB, camelCase in app.
 */

/** Marketplace listing status */
export type SopListingStatus = 'pending_review' | 'published' | 'rejected' | 'suspended';

/** Payment status for SOP license */
export type SopPaymentStatus = 'pending' | 'paid' | 'refunded';

/** Row from sop_listings table */
export interface SopListingRow {
  id: string;
  template_id: string;
  price_cents: number;
  currency: string;
  preview_md: string | null;
  demo_video_url: string | null;
  tags: string | null;  // JSON array string
  total_sales: number;
  total_revenue_cents: number;
  rating_avg: number;
  rating_count: number;
  status: SopListingStatus;
  rejection_reason: string | null;
  published_at: number | null;
  created_at: number;
  updated_at: number;
}

/** Row from sop_licenses table */
export interface SopLicenseRow {
  id: string;
  user_id: string;
  template_id: string;
  listing_id: string;
  price_cents: number;
  payment_id: string | null;
  payment_status: SopPaymentStatus;
  purchased_at: number;
  refunded_at: number | null;
}

/** Input for creating a new marketplace listing */
export interface CreateListingInput {
  templateId: string;
  priceCents: number;
  currency?: string;
  previewMd?: string;
  demoVideoUrl?: string;
  tags?: string[];
}

/** Input for creating a purchase license */
export interface CreateLicenseInput {
  userId: string;
  templateId: string;
  listingId: string;
  priceCents: number;
  paymentId?: string;
}

/** Row from sop_challenges table */
export interface SopChallengeRow {
  id: string;
  title_en: string;
  title_vi: string;
  description_en: string | null;
  description_vi: string | null;
  goal_type: 'sop_runs' | 'sop_sales' | 'commission_earned' | 'sops_created';
  goal_value: number;
  reward_type: 'badge' | 'credits' | 'commission_boost';
  reward_value: string;
  starts_at: number;
  ends_at: number;
  status: 'upcoming' | 'active' | 'ended';
  created_at: number;
}

/** Row from user_challenge_progress table */
export interface UserChallengeProgressRow {
  id: string;
  user_id: string;
  challenge_id: string;
  current_value: number;
  completed_at: number | null;
  reward_claimed: 0 | 1;
  created_at: number;
  updated_at: number;
}
