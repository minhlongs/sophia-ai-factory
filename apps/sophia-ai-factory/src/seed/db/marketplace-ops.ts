/**
 * SOP Creator Marketplace database operations.
 *
 * Pure data access layer for creator profiles, SOP listings,
 * installs, and reviews. All functions accept a D1Database binding
 * explicitly rather than self-resolving, enabling testability.
 *
 * This file re-exports from domain-specific sub-modules.
 *
 * @module seed/db/marketplace-ops
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type {
  CreateCreatorProfileInput,
  CreatorProfile,
  CreateSopListingInput,
  SopListing,
  CreateSopInstallInput,
  SopInstall,
  CreateSopReviewInput,
  SopReview,
  ListingFilters,
} from './marketplace-types';

// ── Creator Profile Operations ─────────────────────────────────────────────

export {
  createCreatorProfile,
  getCreatorProfile,
  updateCreatorProfile,
} from './marketplace-profile-ops';

// ── SOP Listing Operations ────────────────────────────────────────────────

export {
  createSopListing,
  getSopListing,
  listSopListings,
  updateSopListing,
} from './marketplace-listings-ops';

// ── SOP Install Operations ────────────────────────────────────────────────

export {
  createSopInstall,
  getSopInstall,
  listUserInstalls,
} from './marketplace-installs-ops';

// ── SOP Review Operations ─────────────────────────────────────────────────

export {
  createSopReview,
  getSopListingReviews,
} from './marketplace-reviews-ops';
