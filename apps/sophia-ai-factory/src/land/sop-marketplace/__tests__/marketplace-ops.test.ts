/**
 * Tests for marketplace-ops DB functions
 *
 * Uses manual D1 mocks (vi.fn()) since better-sqlite3 native module
 * is unavailable on this Node.js version. Each test builds fresh
 * mock implementations to ensure isolation.
 *
 * @module land/sop-marketplace/__tests__/marketplace-ops
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
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
