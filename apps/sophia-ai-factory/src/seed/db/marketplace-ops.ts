/**
 * SOP Creator Marketplace database operations.
 *
 * Pure data access layer for creator profiles, SOP listings,
 * installs, and reviews. All functions accept a D1Database binding
 * explicitly rather than self-resolving, enabling testability.
 *
 * @module seed/db/marketplace-ops
 */

import type { D1Database } from '@cloudflare/workers-types';
import { toError } from '@/seed/utils/to-error';

// ── Type Interfaces ────────────────────────────────────────────────────────

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

export interface ListingFilters {
  category?: string;
  status?: 'draft' | 'published' | 'archived' | 'pending_review';
}

// ── Creator Profile Operations ─────────────────────────────────────────────

/**
 * Create a new creator profile for the given user.
 * Returns the generated profile ID, or throws on failure.
 */
export async function createCreatorProfile(
  db: D1Database,
  input: CreateCreatorProfileInput,
  tenantId?: string,
): Promise<CreatorProfile> {
  const resolvedTenantId = tenantId ?? 'default';
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  const profile: CreatorProfile = {
    id,
    user_id: input.user_id,
    display_name: input.display_name,
    bio: input.bio ?? null,
    avatar_url: input.avatar_url ?? null,
    payout_method: input.payout_method ?? null,
    payout_address: input.payout_address ?? null,
    total_earnings_cents: 0,
    total_paid_cents: 0,
    status: input.status ?? 'pending',
    created_at: now,
    updated_at: now,
  };

  try {
    const result = await db
      .prepare(
        `INSERT INTO creator_profiles
         (id, user_id, display_name, bio, avatar_url, payout_method,
          payout_address, total_earnings_cents, total_paid_cents,
          status, created_at, updated_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        profile.id, profile.user_id, profile.display_name, profile.bio,
        profile.avatar_url, profile.payout_method, profile.payout_address,
        profile.total_earnings_cents, profile.total_paid_cents,
        profile.status, profile.created_at, profile.updated_at,
        resolvedTenantId,
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create creator profile');
    }

    return profile;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * Get a creator profile by user ID.
 * Returns the profile or null if not found.
 */
export async function getCreatorProfile(
  db: D1Database,
  userId: string,
  tenantId?: string,
): Promise<CreatorProfile | null> {
  const resolvedTenantId = tenantId ?? 'default';

  try {
    const row = await db
      .prepare('SELECT * FROM creator_profiles WHERE user_id = ? AND tenant_id = ?')
      .bind(userId, resolvedTenantId)
      .first<CreatorProfile>();

    return row ?? null;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * Update a creator profile by user ID.
 * Only the provided fields are updated.
 * Returns the updated profile, or null if not found.
 */
export async function updateCreatorProfile(
  db: D1Database,
  userId: string,
  input: Partial<CreateCreatorProfileInput>,
  tenantId?: string,
): Promise<CreatorProfile | null> {
  const now = Math.floor(Date.now() / 1000);

  // Build dynamic SET clause from provided fields
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (input.display_name !== undefined) {
    fields.push('display_name = ?');
    values.push(input.display_name);
  }
  if (input.bio !== undefined) {
    fields.push('bio = ?');
    values.push(input.bio);
  }
  if (input.avatar_url !== undefined) {
    fields.push('avatar_url = ?');
    values.push(input.avatar_url);
  }
  if (input.payout_method !== undefined) {
    fields.push('payout_method = ?');
    values.push(input.payout_method);
  }
  if (input.payout_address !== undefined) {
    fields.push('payout_address = ?');
    values.push(input.payout_address);
  }
  if (input.status !== undefined) {
    fields.push('status = ?');
    values.push(input.status);
  }

  values.push(userId);

  try {
    await db
      .prepare(`UPDATE creator_profiles SET ${fields.join(', ')} WHERE user_id = ?`)
      .bind(...values)
      .run();

    return getCreatorProfile(db, userId, tenantId);
  } catch (error) {
    throw toError(error);
  }
}

// ── SOP Listing Operations ─────────────────────────────────────────────────

/**
 * Create a new SOP listing.
 * Returns the created listing, or throws on failure.
 */
export async function createSopListing(
  db: D1Database,
  input: CreateSopListingInput,
  tenantId?: string,
): Promise<SopListing> {
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const resolvedTenantId = tenantId ?? 'default';

  const listing: SopListing = {
    id,
    creator_id: input.creator_id,
    title: input.title,
    description: input.description ?? null,
    price_cents: input.price_cents,
    category: input.category ?? null,
    tags: input.tags ?? null,
    thumbnail_url: input.thumbnail_url ?? null,
    demo_video_url: input.demo_video_url ?? null,
    sop_template_id: input.sop_template_id,
    status: input.status ?? 'draft',
    install_count: 0,
    rating: 0,
    created_at: now,
    updated_at: now,
  };

  try {
    const result = await db
      .prepare(
        `INSERT INTO sop_listings
         (id, creator_id, title, description, price_cents, category,
          tags, thumbnail_url, demo_video_url, sop_template_id,
          status, install_count, rating, created_at, updated_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        listing.id, listing.creator_id, listing.title, listing.description,
        listing.price_cents, listing.category, listing.tags,
        listing.thumbnail_url, listing.demo_video_url, listing.sop_template_id,
        listing.status, listing.install_count, listing.rating,
        listing.created_at, listing.updated_at, resolvedTenantId,
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create SOP listing');
    }

    return listing;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * Get a single SOP listing by its ID.
 * Returns the listing or null if not found.
 */
export async function getSopListing(
  db: D1Database,
  listingId: string,
): Promise<SopListing | null> {
  try {
    const row = await db
      .prepare('SELECT * FROM sop_listings WHERE id = ?')
      .bind(listingId)
      .first<SopListing>();

    return row ?? null;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * List SOP listings with optional category/status filtering.
 * Results are sorted by rating descending.
 * Returns an empty array if no listings match.
 */
export async function listSopListings(
  db: D1Database,
  filters?: ListingFilters,
  tenantId?: string,
): Promise<SopListing[]> {
  const resolvedTenantId = tenantId ?? 'default';

  try {
    const conditions: string[] = ['tenant_id = ?'];
    const values: unknown[] = [resolvedTenantId];

    if (filters?.category) {
      conditions.push('category = ?');
      values.push(filters.category);
    }
    if (filters?.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const sql = `SELECT * FROM sop_listings ${whereClause} ORDER BY rating DESC`;

    const result = await db.prepare(sql).bind(...values).all<SopListing>();

    return result.results ?? [];
  } catch (error) {
    throw toError(error);
  }
}

/**
 * Update an SOP listing by its ID.
 * Only provided fields are updated.
 * Returns the updated listing, or null if not found.
 */
export async function updateSopListing(
  db: D1Database,
  listingId: string,
  input: Partial<CreateSopListingInput>,
): Promise<SopListing | null> {
  const now = Math.floor(Date.now() / 1000);

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (input.title !== undefined) {
    fields.push('title = ?');
    values.push(input.title);
  }
  if (input.description !== undefined) {
    fields.push('description = ?');
    values.push(input.description);
  }
  if (input.price_cents !== undefined) {
    fields.push('price_cents = ?');
    values.push(input.price_cents);
  }
  if (input.category !== undefined) {
    fields.push('category = ?');
    values.push(input.category);
  }
  if (input.tags !== undefined) {
    fields.push('tags = ?');
    values.push(input.tags);
  }
  if (input.thumbnail_url !== undefined) {
    fields.push('thumbnail_url = ?');
    values.push(input.thumbnail_url);
  }
  if (input.demo_video_url !== undefined) {
    fields.push('demo_video_url = ?');
    values.push(input.demo_video_url);
  }
  if (input.sop_template_id !== undefined) {
    fields.push('sop_template_id = ?');
    values.push(input.sop_template_id);
  }
  if (input.status !== undefined) {
    fields.push('status = ?');
    values.push(input.status);
  }

  values.push(listingId);

  try {
    await db
      .prepare(`UPDATE sop_listings SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return getSopListing(db, listingId);
  } catch (error) {
    throw toError(error);
  }
}

// ── SOP Install Operations ─────────────────────────────────────────────────

/**
 * Create a new SOP install for a user.
 * Checks the user's tier SOP install limit before allowing the install.
 * Throws if the user has reached their install limit.
 * Returns the created install, or throws on failure.
 */
export async function createSopInstall(
  db: D1Database,
  input: CreateSopInstallInput,
  tenantId?: string,
): Promise<SopInstall> {
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const resolvedTenantId = tenantId ?? 'default';

  try {
    // Check the user's tier and SOP install limit
    // Lazy-import to avoid circular dependency: getUserTier reads subscriptions table
    const { getUserTier } = await import('@/seed/db/get-user-tier');
    const { getSopInstallLimit } = await import('@/seed/config/tiers');

    const tier = await getUserTier(input.user_id);
    const limit = getSopInstallLimit(tier);

    // Count current active installs for this user
    const countResult = await db
      .prepare(
        `SELECT COUNT(*) as count FROM sop_installs
         WHERE user_id = ? AND status = 'active'`,
      )
      .bind(input.user_id)
      .first<{ count: number }>();

    const activeCount = countResult?.count ?? 0;

    if (activeCount >= limit) {
      throw new Error(
        `SOP install limit reached: ${activeCount}/${limit} active installs for tier ${tier}`,
      );
    }

    const install: SopInstall = {
      id,
      listing_id: input.listing_id,
      user_id: input.user_id,
      license_id: input.license_id,
      price_cents: input.price_cents,
      commission_id: input.commission_id ?? null,
      status: 'active',
      installed_at: now,
      uninstalled_at: null,
    };

    const result = await db
      .prepare(
        `INSERT INTO sop_installs
         (id, listing_id, user_id, license_id, price_cents,
          commission_id, status, installed_at, uninstalled_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        install.id, install.listing_id, install.user_id, install.license_id,
        install.price_cents, install.commission_id, install.status,
        install.installed_at, install.uninstalled_at, resolvedTenantId,
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create SOP install');
    }

    // Increment install_count on the listing
    await db
      .prepare(
        'UPDATE sop_listings SET install_count = install_count + 1 WHERE id = ?',
      )
      .bind(input.listing_id)
      .run();

    return install;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * Get an SOP install by its license ID.
 * Returns the install or null if not found.
 */
export async function getSopInstall(
  db: D1Database,
  licenseId: string,
): Promise<SopInstall | null> {
  try {
    const row = await db
      .prepare('SELECT * FROM sop_installs WHERE license_id = ?')
      .bind(licenseId)
      .first<SopInstall>();

    return row ?? null;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * List all SOP installs for a given user.
 * Returns an empty array if the user has no installs.
 */
export async function listUserInstalls(
  db: D1Database,
  userId: string,
  tenantId?: string,
): Promise<SopInstall[]> {
  const resolvedTenantId = tenantId ?? 'default';

  try {
    const result = await db
      .prepare(
        'SELECT * FROM sop_installs WHERE user_id = ? AND tenant_id = ? ORDER BY installed_at DESC',
      )
      .bind(userId, resolvedTenantId)
      .all<SopInstall>();

    return result.results ?? [];
  } catch (error) {
    throw toError(error);
  }
}

// ── SOP Review Operations ──────────────────────────────────────────────────

/**
 * Create a review for an installed SOP.
 * Validates that the rating is between 1 and 5.
 * Returns the created review, or throws on failure.
 */
export async function createSopReview(
  db: D1Database,
  input: CreateSopReviewInput,
  tenantId?: string,
): Promise<SopReview> {
  if (input.rating < 1 || input.rating > 5) {
    throw new Error(`Rating must be between 1 and 5, got ${input.rating}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const resolvedTenantId = tenantId ?? 'default';

  const review: SopReview = {
    id,
    install_id: input.install_id,
    user_id: input.user_id,
    rating: input.rating,
    review_text: input.review_text ?? null,
    created_at: now,
  };

  try {
    const result = await db
      .prepare(
        `INSERT INTO sop_reviews (id, install_id, user_id, rating, review_text, created_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        review.id, review.install_id, review.user_id,
        review.rating, review.review_text, review.created_at,
        resolvedTenantId,
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create SOP review');
    }

    // Look up the listing_id for this install, then update average rating
    const installRow = await db
      .prepare('SELECT listing_id FROM sop_installs WHERE id = ?')
      .bind(input.install_id)
      .first<{ listing_id: string }>();

    if (installRow) {
      await db
        .prepare(
          `UPDATE sop_listings
           SET rating = (
             SELECT ROUND(AVG(r.rating), 1)
             FROM sop_reviews r
             JOIN sop_installs i ON r.install_id = i.id
             WHERE i.listing_id = ?
           )
           WHERE id = ?`,
        )
        .bind(installRow.listing_id, installRow.listing_id)
        .run();
    }

    return review;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * Get all reviews for a given SOP listing.
 * Joins through sop_installs to find reviews by listing.
 * Returns an empty array if no reviews exist.
 */
export async function getSopListingReviews(
  db: D1Database,
  listingId: string,
): Promise<SopReview[]> {
  try {
    const result = await db
      .prepare(
        `SELECT r.* FROM sop_reviews r
         JOIN sop_installs i ON r.install_id = i.id
         WHERE i.listing_id = ?
         ORDER BY r.created_at DESC`,
      )
      .bind(listingId)
      .all<SopReview>();

    return result.results ?? [];
  } catch (error) {
    throw toError(error);
  }
}
