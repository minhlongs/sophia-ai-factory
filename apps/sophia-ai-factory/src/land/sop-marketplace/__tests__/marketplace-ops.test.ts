/**
 * Tests for marketplace-ops DB functions
 *
 * Uses manual D1 mocks (vi.fn()) since better-sqlite3 native module
 * is unavailable on this Node.js version. Each test builds fresh
 * mock implementations to ensure isolation.
 *
 * @vitest-environment node
 * @module land/sop-marketplace/__tests__/marketplace-ops
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import {
  createListing as createV1Listing,
  listPublishedListings as listV1PublishedListings,
  updateListingStatus as updateV1ListingStatus,
  incrementSales as incrementV1Sales,
  createLicense as createV1License,
} from '@/seed/sop/sop-repo-marketplace';
import {
  createCreatorProfile,
  getCreatorProfile,
  updateCreatorProfile,
  createSopListing,
  getSopListing,
  listSopListings,
  updateSopListing,
  createSopInstall,
  getSopInstall,
  listUserInstalls,
  createSopReview,
  getSopListingReviews,
} from '@/seed/db/marketplace-ops';

/** Mapping between column names and their positional index in UPDATE SET clauses. */
function parseUpdateSopListings(
  sql: string,
  binds: unknown[],
  listings: Map<string, Record<string, unknown>>,
): { listingId: string; existing: Record<string, unknown> | undefined } {
  // SQL: UPDATE sop_listings SET col1 = ?, col2 = ?, ... WHERE id = ?
  const listingId = binds[binds.length - 1] as string;
  const existing = listings.get(listingId);

  if (!existing || !sql.includes('SET ')) {
    return { listingId, existing: undefined };
  }

  // Parse column names from SET clause
  const setPart = sql.split('SET ')[1]?.split(' WHERE ')[0] ?? '';
  const columns = setPart.split(',').map((s) => s.trim().split(' ')[0]);

  const updated = { ...existing };
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i].trim();
    updated[col] = binds[i];
  }
  listings.set(listingId, updated);

  return { listingId, existing: updated };
}

/** Build a fresh D1 mock with in-memory data store for stateful operations. */
function makeD1Mock(initialData?: {
  creatorProfiles?: Map<string, Record<string, unknown>>;
  sopListings?: Map<string, Record<string, unknown>>;
  sopInstalls?: Map<string, Record<string, unknown>>;
  sopReviews?: Map<string, Record<string, unknown>>;
}) {
  // Use Maps as in-memory "tables"
  const profiles = initialData?.creatorProfiles ?? new Map<string, Record<string, unknown>>();
  const listings = initialData?.sopListings ?? new Map<string, Record<string, unknown>>();
  const installs = initialData?.sopInstalls ?? new Map<string, Record<string, unknown>>();
  const reviews = initialData?.sopReviews ?? new Map<string, Record<string, unknown>>();

  const db = {
    prepare: vi.fn().mockImplementation((sql: string) => {
      return {
        bind: vi.fn().mockImplementation((...binds: unknown[]) => {
          // ── INSERT INTO creator_profiles ──
          if (sql.includes('INSERT INTO creator_profiles')) {
            const [
              id, user_id, display_name, bio, avatar_url,
              payout_method, payout_address, total_earnings_cents,
              total_paid_cents, status, created_at, updated_at,
            ] = binds as string[];

            profiles.set(id, {
              id, user_id, display_name, bio, avatar_url,
              payout_method, payout_address,
              total_earnings_cents: Number(total_earnings_cents),
              total_paid_cents: Number(total_paid_cents),
              status, created_at: Number(created_at), updated_at: Number(updated_at),
            });

            return {
              run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
              first: vi.fn().mockResolvedValue(null),
              all: vi.fn().mockResolvedValue({ results: [], success: true }),
            };
          }

          // ── INSERT INTO sop_listings ──
          if (sql.includes('INSERT INTO sop_listings')) {
            const [
              id, creator_id, title, description, price_cents, category,
              tags, thumbnail_url, demo_video_url, sop_template_id,
              status, install_count, rating, created_at, updated_at,
            ] = binds as string[];

            listings.set(id, {
              id, creator_id, title, description: description ?? null,
              price_cents: Number(price_cents), category: category ?? null,
              tags: tags ?? null, thumbnail_url: thumbnail_url ?? null,
              demo_video_url: demo_video_url ?? null, sop_template_id,
              status: status ?? 'draft', install_count: Number(install_count),
              rating: Number(rating), created_at: Number(created_at),
              updated_at: Number(updated_at),
            });

            return {
              run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
              first: vi.fn().mockResolvedValue(null),
              all: vi.fn().mockResolvedValue({ results: [], success: true }),
            };
          }

          // ── INSERT INTO sop_installs ──
          if (sql.includes('INSERT INTO sop_installs')) {
            const [
              id, listing_id, user_id, license_id, price_cents,
              commission_id, status, installed_at, uninstalled_at,
            ] = binds as string[];

            installs.set(id, {
              id, listing_id, user_id, license_id,
              price_cents: Number(price_cents), commission_id: commission_id ?? null,
              status: status ?? 'active', installed_at: Number(installed_at),
              uninstalled_at: uninstalled_at !== null ? Number(uninstalled_at) : null,
            });

            return {
              run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
              first: vi.fn().mockResolvedValue(null),
              all: vi.fn().mockResolvedValue({ results: [], success: true }),
            };
          }

          // ── INSERT INTO sop_reviews ──
          if (sql.includes('INSERT INTO sop_reviews')) {
            const [id, install_id, user_id, rating, review_text, created_at] = binds as string[];

            reviews.set(id, {
              id, install_id, user_id, rating: Number(rating),
              review_text: review_text ?? null, created_at: Number(created_at),
            });

            return {
              run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
              first: vi.fn().mockResolvedValue(null),
              all: vi.fn().mockResolvedValue({ results: [], success: true }),
            };
          }

          // ── SELECT * FROM creator_profiles WHERE user_id = ? ──
          if (sql.includes('FROM creator_profiles') && sql.includes('WHERE')) {
            const userId = binds[0] as string;
            const found = Array.from(profiles.values()).find(
              (p) => p.user_id === userId,
            );
            return {
              first: vi.fn().mockResolvedValue(found ?? null),
              all: vi.fn().mockResolvedValue({ results: found ? [found] : [], success: true }),
              run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
            };
          }

          // ── UPDATE creator_profiles ──
          if (sql.includes('UPDATE creator_profiles')) {
            parseUpdateCreatorProfile(sql, binds, profiles);
            const userId = binds[binds.length - 1] as string;
            const profile = Array.from(profiles.values()).find((p) => p.user_id === userId);
            return {
              run: vi.fn().mockResolvedValue({ success: true, meta: { changes: profile ? 1 : 0 } }),
              first: vi.fn().mockResolvedValue(profile ?? null),
              all: vi.fn().mockResolvedValue({ results: profile ? [profile] : [], success: true }),
            };
          }

          // ── SELECT * FROM sop_listings WHERE id = ? (single listing lookup) ──
          if (sql.includes('FROM sop_listings') && sql.includes('WHERE id = ?')) {
            const listingId = binds[0] as string;
            const found = listings.get(listingId) ?? null;
            return {
              first: vi.fn().mockResolvedValue(found),
              all: vi.fn().mockResolvedValue({ results: found ? [found] : [], success: true }),
              run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
            };
          }

          // ── SELECT * FROM sop_listings WHERE tenant_id = ? [AND status/category = ?] ORDER BY (listSopListings) ──
          if (sql.includes('FROM sop_listings') && sql.includes('ORDER BY')) {
            let result = Array.from(listings.values());

            // tenant_id is always the first bind (binds[0])
            const hasTenantFilter = sql.includes('tenant_id = ?');
            // status and category filters come after tenant_id
            const categoryIdx = hasTenantFilter ? 1 : 0;
            const statusIdx = hasTenantFilter
              ? (sql.includes('category = ?') ? 2 : 1)
              : (sql.includes('category = ?') ? 1 : 0);

            if (sql.includes('category = ?')) {
              result = result.filter((l) => l.category === binds[categoryIdx]);
            }
            if (sql.includes('status = ?')) {
              result = result.filter((l) => l.status === binds[statusIdx]);
            }
            return {
              all: vi.fn().mockResolvedValue({ results: result, success: true }),
              first: vi.fn().mockResolvedValue(result[0] ?? null),
              run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
            };
          }

          // ── UPDATE sop_listings SET ... WHERE id = ? ──
          if (sql.includes('UPDATE sop_listings')) {
            const { existing } = parseUpdateSopListings(sql, binds, listings);
            return {
              run: vi.fn().mockResolvedValue({ success: true, meta: { changes: existing ? 1 : 0 } }),
              first: vi.fn().mockResolvedValue(existing ?? null),
              all: vi.fn().mockResolvedValue({ results: existing ? [existing] : [], success: true }),
            };
          }

          // ── SELECT * FROM sop_installs WHERE license_id = ? ──
          if (sql.includes('FROM sop_installs') && sql.includes('license_id')) {
            const licenseId = binds[0] as string;
            const found = Array.from(installs.values()).find(
              (i) => i.license_id === licenseId,
            ) ?? null;
            return {
              first: vi.fn().mockResolvedValue(found),
              all: vi.fn().mockResolvedValue({ results: found ? [found] : [], success: true }),
              run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
            };
          }

          // ── SELECT * FROM sop_installs WHERE user_id = ? ORDER BY installed_at DESC ──
          if (sql.includes('FROM sop_installs') && sql.includes('user_id')) {
            const userId = binds[0] as string;
            const userInstalls = Array.from(installs.values())
              .filter((i) => i.user_id === userId);
            return {
              all: vi.fn().mockResolvedValue({ results: userInstalls, success: true }),
              first: vi.fn().mockResolvedValue(userInstalls[0] ?? null),
              run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
            };
          }

          // ── SELECT listing_id FROM sop_installs WHERE id = ? (review lookup) ──
          if (sql.includes('listing_id FROM sop_installs')) {
            const installId = binds[0] as string;
            const install = installs.get(installId);
            return {
              first: vi.fn().mockResolvedValue(install ? { listing_id: install.listing_id } : null),
              all: vi.fn().mockResolvedValue({ results: [], success: true }),
              run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
            };
          }

          // ── UPDATE sop_listings SET rating = ... (review rating update) ──
          if (sql.includes('UPDATE sop_listings SET rating')) {
            return {
              run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
              first: vi.fn().mockResolvedValue(null),
              all: vi.fn().mockResolvedValue({ results: [], success: true }),
            };
          }

          // ── SELECT r.* FROM sop_reviews r JOIN sop_installs ... (listing reviews) ──
          if (sql.includes('FROM sop_reviews') && sql.includes('JOIN')) {
            const listingId = binds[0] as string;
            const listingInstalls = Array.from(installs.values())
              .filter((i) => i.listing_id === listingId)
              .map((i) => i.id);
            const listingReviews = Array.from(reviews.values())
              .filter((r) => listingInstalls.includes(r.install_id as string));
            return {
              all: vi.fn().mockResolvedValue({ results: listingReviews, success: true }),
              first: vi.fn().mockResolvedValue(listingReviews[0] ?? null),
              run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
            };
          }

          // ── SELECT COUNT(*) (row counting fallback) ──
          if (sql.includes('COUNT(*)') || sql.includes('count(*)')) {
            return {
              first: vi.fn().mockResolvedValue({ count: 0 }),
              all: vi.fn().mockResolvedValue({ results: [{ count: 0 }], success: true }),
              run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
            };
          }

          // ── UPDATE sop_installs (install count increment) ──
          if (sql.includes('UPDATE sop_installs')) {
            return {
              run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
              first: vi.fn().mockResolvedValue(null),
              all: vi.fn().mockResolvedValue({ results: [], success: true }),
            };
          }

          // Fallback
          return {
            run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [], success: true }),
          };
        }),
        run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [], success: true }),
      };
    }),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
  };

  return db;
}

/** Apply UPDATE creator_profiles binds to the in-memory store. */
function parseUpdateCreatorProfile(
  sql: string,
  binds: unknown[],
  profiles: Map<string, Record<string, unknown>>,
): void {
  const userId = binds[binds.length - 1] as string;
  const profile = Array.from(profiles.values()).find((p) => p.user_id === userId);
  if (!profile) return;

  const setPart = sql.split('SET ')[1]?.split(' WHERE ')[0] ?? '';
  const columns = setPart.split(',').map((s) => s.trim().split(' ')[0]);

  const updated = { ...profile };
  for (let i = 0; i < columns.length; i++) {
    updated[columns[i].trim()] = binds[i];
  }
  profiles.set(profile.id as string, updated);
}

describe('createCreatorProfile', () => {
  it('inserts and returns a creator profile', async () => {
    const db = makeD1Mock();

    const profile = await createCreatorProfile(db as unknown as D1Database, {
      user_id: 'user-1',
      display_name: 'Test Creator',
      bio: 'Building awesome SOPs',
      payout_method: 'nowpayments',
      payout_address: 'TRC20-addr-123',
      status: 'pending',
    });

    expect(profile.id).toBeDefined();
    expect(profile.user_id).toBe('user-1');
    expect(profile.display_name).toBe('Test Creator');
    expect(profile.bio).toBe('Building awesome SOPs');
    expect(profile.payout_method).toBe('nowpayments');
    expect(profile.payout_address).toBe('TRC20-addr-123');
    expect(profile.status).toBe('pending');
    expect(profile.total_earnings_cents).toBe(0);
    expect(profile.total_paid_cents).toBe(0);
    expect(profile.created_at).toBeGreaterThan(0);
    expect(profile.updated_at).toBeGreaterThan(0);
  });
});

describe('getCreatorProfile', () => {
  it('returns a profile by userId', async () => {
    const profiles = new Map<string, Record<string, unknown>>();
    profiles.set('p1', {
      id: 'p1', user_id: 'user-2', display_name: 'Fetch Tester',
      bio: null, avatar_url: null, payout_method: null, payout_address: null,
      total_earnings_cents: 0, total_paid_cents: 0,
      status: 'active', created_at: 1000, updated_at: 1000,
    });
    const db = makeD1Mock({ creatorProfiles: profiles });

    const fetched = await getCreatorProfile(db as unknown as D1Database, 'user-2');
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe('p1');
    expect(fetched!.display_name).toBe('Fetch Tester');
  });

  it('returns null for unknown userId', async () => {
    const db = makeD1Mock();
    const fetched = await getCreatorProfile(db as unknown as D1Database, 'nonexistent');
    expect(fetched).toBeNull();
  });
});

describe('updateCreatorProfile', () => {
  it('updates provided fields', async () => {
    const profiles = new Map<string, Record<string, unknown>>();
    profiles.set('p2', {
      id: 'p2', user_id: 'user-3', display_name: 'Original Name',
      bio: null, avatar_url: null, payout_method: null, payout_address: null,
      total_earnings_cents: 0, total_paid_cents: 0,
      status: 'pending', created_at: 1000, updated_at: 1000,
    });
    const db = makeD1Mock({ creatorProfiles: profiles });

    const updated = await updateCreatorProfile(db as unknown as D1Database, 'user-3', {
      display_name: 'Updated Name',
      bio: 'New bio text',
      status: 'active',
    });

    expect(updated).not.toBeNull();
    expect(updated!.display_name).toBe('Updated Name');
    expect(updated!.bio).toBe('New bio text');
    expect(updated!.status).toBe('active');
  });

  it('returns null for non-existent user', async () => {
    const db = makeD1Mock();
    const updated = await updateCreatorProfile(db as unknown as D1Database, 'unknown', {
      display_name: 'Nope',
    });
    expect(updated).toBeNull();
  });
});

describe('createSopListing', () => {
  it('creates a listing with correct defaults', async () => {
    const db = makeD1Mock();

    const listing = await createSopListing(db as unknown as D1Database, {
      creator_id: 'creator-1',
      title: 'My Awesome SOP',
      description: 'Step-by-step guide',
      price_cents: 9900,
      category: 'marketing',
      tags: 'facebook,ads',
      sop_template_id: 'tpl-1',
      status: 'draft',
    });

    expect(listing.id).toBeDefined();
    expect(listing.title).toBe('My Awesome SOP');
    expect(listing.price_cents).toBe(9900);
    expect(listing.status).toBe('draft');
    expect(listing.install_count).toBe(0);
    expect(listing.rating).toBe(0);
  });
});

describe('getSopListing', () => {
  it('returns listing by id', async () => {
    const listings = new Map<string, Record<string, unknown>>();
    listings.set('l1', {
      id: 'l1', creator_id: 'creator-2', title: 'Find Me',
      description: null, price_cents: 4900, category: null,
      tags: null, thumbnail_url: null, demo_video_url: null,
      sop_template_id: 'tpl-2', status: 'draft', install_count: 0, rating: 0,
      created_at: 1000, updated_at: 1000,
    });
    const db = makeD1Mock({ sopListings: listings });

    const fetched = await getSopListing(db as unknown as D1Database, 'l1');
    expect(fetched).not.toBeNull();
    expect(fetched!.title).toBe('Find Me');
  });

  it('returns null for unknown id', async () => {
    const db = makeD1Mock();
    const fetched = await getSopListing(db as unknown as D1Database, 'bad-id');
    expect(fetched).toBeNull();
  });
});

describe('listSopListings', () => {
  it('returns filtered and sorted listings', async () => {
    const listings = new Map<string, Record<string, unknown>>();
    listings.set('l1', {
      id: 'l1', creator_id: 'creator-3', title: 'Published SOP A',
      description: null, price_cents: 2000, category: 'marketing',
      tags: null, thumbnail_url: null, demo_video_url: null,
      sop_template_id: 'tpl-a', status: 'published', install_count: 1, rating: 4.5,
      created_at: 1000, updated_at: 1000,
    });
    listings.set('l2', {
      id: 'l2', creator_id: 'creator-3', title: 'Published SOP B',
      description: null, price_cents: 3000, category: 'marketing',
      tags: null, thumbnail_url: null, demo_video_url: null,
      sop_template_id: 'tpl-b', status: 'published', install_count: 2, rating: 5.0,
      created_at: 1000, updated_at: 1000,
    });
    listings.set('l3', {
      id: 'l3', creator_id: 'creator-3', title: 'Draft SOP',
      description: null, price_cents: 1000, category: 'ads',
      tags: null, thumbnail_url: null, demo_video_url: null,
      sop_template_id: 'tpl-c', status: 'draft', install_count: 0, rating: 0,
      created_at: 1000, updated_at: 1000,
    });
    const db = makeD1Mock({ sopListings: listings });

    const publishedOnly = await listSopListings(db as unknown as D1Database, {
      status: 'published',
    });
    expect(publishedOnly.length).toBe(2);
    expect(publishedOnly.every((l) => l.status === 'published')).toBe(true);

    const marketingOnly = await listSopListings(db as unknown as D1Database, {
      category: 'marketing',
    });
    expect(marketingOnly.length).toBe(2);
    expect(marketingOnly.every((l) => l.category === 'marketing')).toBe(true);
  });

  it('returns empty array when no listings match', async () => {
    const db = makeD1Mock();
    const results = await listSopListings(db as unknown as D1Database, {
      category: 'nonexistent',
    });
    expect(results).toEqual([]);
  });
});

describe('updateSopListing', () => {
  it('updates status field', async () => {
    const listings = new Map<string, Record<string, unknown>>();
    listings.set('l-upd', {
      id: 'l-upd', creator_id: 'creator-4', title: 'Publish Me',
      description: null, price_cents: 5000, category: null,
      tags: null, thumbnail_url: null, demo_video_url: null,
      sop_template_id: 'tpl-pub', status: 'draft', install_count: 0, rating: 0,
      created_at: 1000, updated_at: 1000,
    });
    const db = makeD1Mock({ sopListings: listings });

    const updated = await updateSopListing(db as unknown as D1Database, 'l-upd', {
      status: 'published',
    });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('published');
  });
});

describe('createSopInstall', () => {
  it('creates an install record', async () => {
    const installs = new Map<string, Record<string, unknown>>();
    // Need tiers mock for createSopInstall — it calls getUserTier + getSopInstallLimit
    // via dynamic imports. Dynamic import inside vitest resolves real modules unless mocked.
    // Mock these at module level.
    const db = makeD1Mock({ sopInstalls: installs });

    const install = await createSopInstall(db as unknown as D1Database, {
      listing_id: 'listing-install-1',
      user_id: 'user-install-1',
      license_id: 'license-abc-123',
      price_cents: 3000,
    });

    expect(install.id).toBeDefined();
    expect(install.listing_id).toBe('listing-install-1');
    expect(install.user_id).toBe('user-install-1');
    expect(install.license_id).toBe('license-abc-123');
    expect(install.status).toBe('active');
    expect(install.installed_at).toBeGreaterThan(0);
    expect(install.uninstalled_at).toBeNull();
  });
});

describe('getSopInstall', () => {
  it('returns install by licenseId', async () => {
    const installs = new Map<string, Record<string, unknown>>();
    installs.set('inst-1', {
      id: 'inst-1', listing_id: 'l-find', user_id: 'user-find',
      license_id: 'license-find-456', price_cents: 4000,
      commission_id: null, status: 'active', installed_at: 2000, uninstalled_at: null,
    });
    const db = makeD1Mock({ sopInstalls: installs });

    const fetched = await getSopInstall(db as unknown as D1Database, 'license-find-456');
    expect(fetched).not.toBeNull();
    expect(fetched!.user_id).toBe('user-find');
    expect(fetched!.license_id).toBe('license-find-456');
  });
});

describe('listUserInstalls', () => {
  it('returns installs for a given user', async () => {
    const installs = new Map<string, Record<string, unknown>>();
    installs.set('inst-ui-1', {
      id: 'inst-ui-1', listing_id: 'l-ui', user_id: 'user-ui-1',
      license_id: 'license-ui-1', price_cents: 2500,
      commission_id: null, status: 'active', installed_at: 2000, uninstalled_at: null,
    });
    const db = makeD1Mock({ sopInstalls: installs });

    const userInstalls = await listUserInstalls(db as unknown as D1Database, 'user-ui-1');
    expect(userInstalls.length).toBe(1);
    expect(userInstalls[0].user_id).toBe('user-ui-1');

    const noneInstalls = await listUserInstalls(db as unknown as D1Database, 'no-installs');
    expect(noneInstalls).toEqual([]);
  });
});

describe('createSopReview', () => {
  it('creates a valid review', async () => {
    const installs = new Map<string, Record<string, unknown>>();
    installs.set('inst-review-1', {
      id: 'inst-review-1', listing_id: 'l-review', user_id: 'user-review-1',
      license_id: 'license-review-1', price_cents: 1500,
      commission_id: null, status: 'active', installed_at: 2000, uninstalled_at: null,
    });
    const reviews = new Map<string, Record<string, unknown>>();
    const db = makeD1Mock({ sopInstalls: installs, sopReviews: reviews });

    const review = await createSopReview(db as unknown as D1Database, {
      install_id: 'inst-review-1',
      user_id: 'user-review-1',
      rating: 5,
      review_text: 'Great SOP!',
    });

    expect(review.id).toBeDefined();
    expect(review.rating).toBe(5);
    expect(review.review_text).toBe('Great SOP!');
    expect(review.install_id).toBe('inst-review-1');
  });
});

describe('getSopListingReviews', () => {
  it('returns reviews for a listing', async () => {
    const installs = new Map<string, Record<string, unknown>>();
    installs.set('inst-rev-1', {
      id: 'inst-rev-1', listing_id: 'l-reviews', user_id: 'user-rev-1',
      license_id: 'license-rev-1', price_cents: 2000,
      commission_id: null, status: 'active', installed_at: 2000, uninstalled_at: null,
    });
    const reviews = new Map<string, Record<string, unknown>>();
    reviews.set('rev-1', {
      id: 'rev-1', install_id: 'inst-rev-1', user_id: 'user-rev-1',
      rating: 4, review_text: 'Pretty good', created_at: 3000,
    });
    const db = makeD1Mock({ sopInstalls: installs, sopReviews: reviews });

    const listingReviews = await getSopListingReviews(db as unknown as D1Database, 'l-reviews');
    expect(listingReviews.length).toBe(1);
    expect(listingReviews[0].rating).toBe(4);

    const noReviews = await getSopListingReviews(db as unknown as D1Database, 'no-reviews');
    expect(noReviews).toEqual([]);
  });
});

function wrapSqliteAsD1(sqlite: DatabaseSync): D1Database {
  const normalizeBinds = (binds: unknown[]) =>
    binds.map((v) => (v === undefined ? null : (v as string | number | bigint | Buffer | null)));

  const makeStmt = (sql: string, boundArgs: unknown[] = []) => ({
    bind: (...args: unknown[]) => makeStmt(sql, args),
    run: async () => {
      const stmt = sqlite.prepare(sql);
      const res = stmt.run(...normalizeBinds(boundArgs));
      return { success: true, meta: { changes: Number(res.changes) } };
    },
    first: async <T = Record<string, unknown>>() => {
      const stmt = sqlite.prepare(sql);
      const row = stmt.get(...normalizeBinds(boundArgs)) as T | undefined;
      return row ?? null;
    },
    all: async <T = Record<string, unknown>>() => {
      const stmt = sqlite.prepare(sql);
      const rows = stmt.all(...normalizeBinds(boundArgs)) as T[];
      return { results: rows, success: true, meta: {} };
    },
  });

  return {
    prepare: (sql: string) => makeStmt(sql),
  } as unknown as D1Database;
}

describe('0474 + 0473 SQLite Schema Reconciliation & V1/V2 Coexistence', () => {
  it('preserves V1 rows/defaults without fake template mapping and supports both V1 and V2 operations', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE "user" (id TEXT PRIMARY KEY);
      CREATE TABLE sop_templates (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        name_en TEXT NOT NULL,
        name_vi TEXT NOT NULL,
        category TEXT NOT NULL,
        author_user_id TEXT,
        status TEXT NOT NULL DEFAULT 'published'
      );
      CREATE TABLE creator_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        bio TEXT,
        avatar_url TEXT,
        payout_method TEXT,
        payout_address TEXT,
        total_earnings_cents INTEGER DEFAULT 0,
        total_paid_cents INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        tenant_id TEXT NOT NULL DEFAULT 'default',
        created_at INTEGER NOT NULL DEFAULT 1000,
        updated_at INTEGER NOT NULL DEFAULT 1000,
        payout_rail TEXT DEFAULT 'USDT',
        bank_bin TEXT,
        bank_account_number TEXT,
        bank_account_name TEXT
      );
      INSERT INTO "user" (id) VALUES ('u-v1'), ('u-v2'), ('u-buyer');
      INSERT INTO sop_templates (id, slug, name_en, name_vi, category, author_user_id, status)
      VALUES
        ('tpl-v1-seeded', 'v1-seeded', 'V1 Seeded EN', 'V1 Seeded VI', 'automation', 'u-v1', 'published'),
        ('tpl-v1-after', 'v1-after', 'V1 After EN', 'V1 After VI', 'content', 'u-v1', 'published');
      INSERT INTO creator_profiles (id, user_id, display_name, status, tenant_id)
      VALUES ('cp-v2-1', 'u-v2', 'V2 Creator', 'active', 'default');
    `);

    const migrationsDir = resolve(process.cwd(), 'migrations');
    sqlite.exec(readFileSync(resolve(migrationsDir, '0126_sop_marketplace_tables.sql'), 'utf8'));

    // Seed pre-existing V1 listing and license before 0474 runs
    sqlite.exec(`
      INSERT INTO sop_listings (
        id, template_id, price_cents, currency, preview_md, demo_video_url,
        tags, total_sales, total_revenue_cents, rating_avg, rating_count,
        status, rejection_reason, published_at, created_at, updated_at
      ) VALUES (
        'v1-seed-id', 'tpl-v1-seeded', 1900, 'USD', 'Preview MD', 'https://example.test/v1.mp4',
        '["tag1"]', 4, 7600, 4.75, 4,
        'published', NULL, 1700000100, 1700000000, 1700000200
      );
    `);

    // Apply 0474 reconciliation then 0473 partial unique index
    sqlite.exec(readFileSync(resolve(migrationsDir, '0474_reconcile_sop_marketplace_schema.sql'), 'utf8'));
    sqlite.exec(readFileSync(resolve(migrationsDir, '0473_sop_installs_active_unique_index.sql'), 'utf8'));

    const d1 = wrapSqliteAsD1(sqlite);

    // 1. Pre-existing V1 row is preserved bit-for-bit with no fake sop_template_id mapping
    const seededRow = sqlite.prepare(`SELECT * FROM sop_listings WHERE id = 'v1-seed-id'`).get() as Record<string, unknown>;
    expect(seededRow.template_id).toBe('tpl-v1-seeded');
    expect(seededRow.price_cents).toBe(1900);
    expect(seededRow.currency).toBe('USD');
    expect(seededRow.preview_md).toBe('Preview MD');
    expect(seededRow.total_sales).toBe(4);
    expect(seededRow.total_revenue_cents).toBe(7600);
    expect(seededRow.rating_avg).toBe(4.75);
    expect(seededRow.rating_count).toBe(4);
    expect(seededRow.status).toBe('published');
    expect(seededRow.tenant_id).toBe('default');
    expect(seededRow.creator_id).toBeNull();
    expect(seededRow.sop_template_id).toBeNull();

    // 2. V1 repository operations continue to work on the unified table
    const newV1 = await createV1Listing(d1, {
      templateId: 'tpl-v1-after',
      priceCents: 0,
      previewMd: 'V1 after reconcile',
      tags: ['v1'],
    });
    expect(newV1.template_id).toBe('tpl-v1-after');
    expect(newV1.status).toBe('pending_review');

    await updateV1ListingStatus(d1, newV1.id, 'published');
    await incrementV1Sales(d1, newV1.id, 0);
    const v1Catalog = await listV1PublishedListings(d1);
    expect(v1Catalog.map((r) => r.id)).toContain('v1-seed-id');
    expect(v1Catalog.map((r) => r.id)).toContain(newV1.id);

    const v1Lic = await createV1License(d1, {
      userId: 'u-buyer',
      templateId: 'tpl-v1-after',
      listingId: newV1.id,
      priceCents: 0,
    });
    expect(v1Lic.listing_id).toBe(newV1.id);

    // 3. V2 repository operations work without template_id and support draft/archived
    const newV2 = await createSopListing(d1, {
      creator_id: 'cp-v2-1',
      title: 'V2 Workflow Listing',
      description: 'Created via V2 repo',
      price_cents: 0,
      category: 'marketing',
      sop_template_id: 'v2-sop-tpl-1',
      status: 'draft',
    });
    expect(newV2.status).toBe('draft');
    const rawV2 = sqlite.prepare(`SELECT template_id, sop_template_id FROM sop_listings WHERE id = ?`).get(newV2.id) as Record<string, unknown>;
    expect(rawV2.template_id).toBeNull();
    expect(rawV2.sop_template_id).toBe('v2-sop-tpl-1');

    // All 6 statuses are accepted; invalid status is rejected
    for (const validStatus of ['pending_review', 'published', 'rejected', 'suspended', 'draft', 'archived'] as const) {
      sqlite.prepare(`UPDATE sop_listings SET status = ? WHERE id = ?`).run(validStatus, newV2.id);
    }
    expect(() => {
      sqlite.prepare(`UPDATE sop_listings SET status = 'invalid' WHERE id = ?`).run(newV2.id);
    }).toThrow(/CHECK constraint failed/);

    // 4. Verify all 21 named indexes (20 from 0474 + 1 from 0473) exist in sqlite_master
    const indexes = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%'`)
      .all() as Array<{ name: string }>;
    const indexNames = new Set(indexes.map((i) => i.name));
    for (const expectedIdx of [
      'idx_listing_status',
      'idx_listing_template',
      'idx_sop_listings_creator_id',
      'idx_sop_listings_status',
      'idx_sop_listings_category',
      'idx_sop_listings_rating',
      'idx_sop_listings_tenant_id',
      'idx_sop_installs_listing_id',
      'idx_sop_installs_user_id',
      'idx_sop_installs_license_id',
      'idx_sop_installs_status',
      'idx_sop_installs_user_status',
      'idx_sop_installs_tenant_id',
      'idx_sop_installs_user_listing_active',
      'idx_sop_reviews_install_id',
      'idx_sop_reviews_user_id',
      'idx_sop_reviews_rating',
      'idx_sop_reviews_tenant_id',
      'idx_creator_profiles_user_id',
      'idx_creator_profiles_status',
      'idx_creator_profiles_tenant_id',
    ]) {
      expect(indexNames.has(expectedIdx)).toBe(true);
    }
  });
});
