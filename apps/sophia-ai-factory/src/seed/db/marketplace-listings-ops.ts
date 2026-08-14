/**
 * SOP Creator Marketplace — SOP listing database operations.
 *
 * Pure data access layer for SOP listings. All functions accept
 * a D1Database binding explicitly rather than self-resolving,
 * enabling testability.
 *
 * @module seed/db/marketplace-listings-ops
 */

import type { D1Database } from '@cloudflare/workers-types';
import { toError } from '@/seed/utils/to-error';
import type { CreateSopListingInput, SopListing, ListingFilters } from './marketplace-types';

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
