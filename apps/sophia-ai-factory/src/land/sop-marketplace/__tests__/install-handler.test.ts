/**
 * Tests for SOP Installation Handler Server Actions & Fail-Closed Integrity
 *
 * Unit tests for installSop, uninstallSop, and listing publishing gates.
 * Validates fail-closed behavior for paid listings, free install handling,
 * elimination of synthetic payment IDs, absence of commission on free installs,
 * DB-enforced idempotency handling, and reinstall support.
 *
 * @module land/sop-marketplace/__tests__/install-handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';

// ── Module-level mocks ─────────────────────────────────────────────────────

const mockUser = { id: 'user-test-001', email: 'test@example.com' };

const mockFreeListing = {
  id: 'listing-free-001',
  creator_id: 'creator-001',
  sop_template_id: 'tpl-001',
  price_cents: 0,
  status: 'published',
  title: 'Free Test SOP',
  description: 'Test description',
  category: 'marketing',
  tags: null,
  thumbnail_url: null,
  demo_video_url: null,
  install_count: 0,
  rating: 0,
  created_at: 1000000,
  updated_at: 1000000,
};

const mockPaidListing = {
  ...mockFreeListing,
  id: 'listing-paid-001',
  price_cents: 9900,
  title: 'Paid Test SOP',
};

const mockInstall = {
  id: 'install-001',
  listing_id: 'listing-free-001',
  user_id: 'user-test-001',
  license_id: 'license-abc-123',
  price_cents: 0,
  commission_id: null,
  status: 'active',
  installed_at: 2000000,
  uninstalled_at: null,
};

const mockCreatorProfile = {
  id: 'creator-001',
  user_id: 'user-test-001',
  status: 'active',
};

// Track calls to the D1 mock for assertion
const d1Calls: { sql: string; binds: unknown[] }[] = [];

function makeD1Mock() {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockImplementation((...binds: unknown[]) => {
        d1Calls.push({ sql, binds });

        // Duplicate check: SELECT COUNT(*) ... WHERE user_id = ? AND listing_id = ? AND status = 'active'
        if (sql.includes('SELECT COUNT(*)') && sql.includes('listing_id = ?')) {
          return {
            first: vi.fn().mockResolvedValue({ count: 0 }),
            all: vi.fn().mockResolvedValue({ results: [], success: true }),
            run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
          };
        }

        // Active count: SELECT COUNT(*) ... WHERE user_id = ? AND status = 'active'
        if (sql.includes('SELECT COUNT(*)') && sql.includes('status')) {
          return {
            first: vi.fn().mockResolvedValue({ count: 0 }),
            all: vi.fn().mockResolvedValue({ results: [], success: true }),
            run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
          };
        }

        // UPDATE sop_installs
        if (sql.startsWith('UPDATE')) {
          return {
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [], success: true }),
          };
        }

        return {
          first: vi.fn().mockResolvedValue({ count: 0 }),
          all: vi.fn().mockResolvedValue({ results: [], success: true }),
          run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
        };
      }),
      run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
    })),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
  };
}

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/db/org-membership', () => ({
  requireOrgMembership: vi.fn(),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn().mockResolvedValue('PREMIUM'),
}));

vi.mock('@/seed/config/tiers', () => ({
  getSopInstallLimit: vi.fn().mockReturnValue(10),
}));

vi.mock('@/seed/db/marketplace-ops', () => ({
  getSopListing: vi.fn(),
  getSopInstall: vi.fn(),
  createSopInstall: vi.fn(),
  updateSopListing: vi.fn(),
  getCreatorProfile: vi.fn(),
}));

vi.mock('../commission-split', () => ({
  calculateCreatorCommission: vi.fn(),
  recordSopSaleCommission: vi.fn(),
}));

// Preserve the enabled-path integrity tests; containment is verified separately.
vi.mock('../availability', () => ({
  CREATOR_MARKETPLACE_V2_ENABLED: true,
  marketplaceTemporarilyUnavailableError: () => ({
    code: 'MARKETPLACE_TEMPORARILY_UNAVAILABLE',
    message: 'Creator Marketplace is temporarily unavailable while database integrity is being verified.',
  }),
}));

import { installSop, uninstallSop } from '../install-handler';
import { publishListing } from '../listing-lifecycle';
import { updateSopListing } from '../listing-crud';
import { approveListingAdmin } from '../listing-admin';
import { recordSopSaleCommission } from '../commission-split';
import { createSopInstall as dbCreateSopInstall } from '@/seed/db/marketplace-ops';

beforeEach(async () => {
  vi.clearAllMocks();
  d1Calls.length = 0;
  const { requireOrgMembership: orgCheck } = await import('@/seed/db/org-membership');
  vi.mocked(orgCheck).mockResolvedValue({ authorized: true, orgId: 'test-org', role: 'owner' });
});

describe('installSop - Fail-Closed & Integrity', () => {
  it('1. free install succeeds and does not create commission or synthetic payment ID', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue(mockFreeListing as never);
    vi.mocked(dbCreateSopInstall).mockResolvedValue(mockInstall as never);

    const result = await installSop('listing-free-001');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.licenseId).toBeDefined();
    }

    // Commission must NOT be called for free install
    expect(recordSopSaleCommission).not.toHaveBeenCalled();

    // dbCreateSopInstall must receive commission_id = null and price_cents = 0
    expect(dbCreateSopInstall).toHaveBeenCalledTimes(1);
    expect(dbCreateSopInstall).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        listing_id: 'listing-free-001',
        user_id: 'user-test-001',
        price_cents: 0,
        commission_id: null,
      }),
      'test-org'
    );
  });

  it('2. paid listing install is rejected fail-closed with PAYMENT_REQUIRED before any write', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    const d1Mock = makeD1Mock();
    vi.mocked(getD1).mockResolvedValue(d1Mock as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue(mockPaidListing as never);

    const result = await installSop('listing-paid-001');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_REQUIRED');
    }

    // Must NOT write to database
    expect(dbCreateSopInstall).not.toHaveBeenCalled();
    expect(recordSopSaleCommission).not.toHaveBeenCalled();
    // Must NOT execute any queries past the initial listing check
    expect(d1Calls.length).toBe(0);
  });

  it('2b. invalid or null price listing is rejected fail-closed with PAYMENT_REQUIRED before any write', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue({
      ...mockFreeListing,
      price_cents: null as unknown as number,
    } as never);

    const result = await installSop('listing-null-price');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_REQUIRED');
    }
    expect(dbCreateSopInstall).not.toHaveBeenCalled();
    expect(recordSopSaleCommission).not.toHaveBeenCalled();
  });

  it('3. returns NOT_AUTHENTICATED when no user', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await installSop('listing-free-001');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_AUTHENTICATED');
    }
  });

  it('returns LISTING_NOT_FOUND when listing does not exist', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue(null);

    const result = await installSop('listing-nonexistent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('LISTING_NOT_FOUND');
    }
  });

  it('returns LISTING_NOT_PUBLISHED for draft listings', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue({ ...mockFreeListing, status: 'draft' } as never);

    const result = await installSop('listing-draft');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('LISTING_NOT_PUBLISHED');
    }
  });

  it('returns ALREADY_INSTALLED for pre-checked duplicate active install', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const duplicateD1 = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation(() => {
          if (sql.includes('SELECT COUNT(*)') && sql.includes('listing_id = ?')) {
            return {
              first: vi.fn().mockResolvedValue({ count: 1 }),
            };
          }
          return {
            first: vi.fn().mockResolvedValue({ count: 0 }),
            all: vi.fn().mockResolvedValue({ results: [], success: true }),
            run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
          };
        }),
        run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [], success: true }),
      })),
    } as unknown as D1Database;

    vi.mocked(getD1).mockResolvedValue(duplicateD1);
    vi.mocked(getSopListing).mockResolvedValue(mockFreeListing as never);

    const result = await installSop('listing-free-001');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ALREADY_INSTALLED');
    }
  });

  it('4. concurrent duplicate race condition is caught by DB unique constraint and returns ALREADY_INSTALLED', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue(mockFreeListing as never);

    // Simulate DB unique constraint collision on concurrent insert
    vi.mocked(dbCreateSopInstall).mockRejectedValueOnce(
      new Error('UNIQUE constraint failed: sop_installs.user_id, sop_installs.listing_id')
    );

    const result = await installSop('listing-free-001');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ALREADY_INSTALLED');
    }
  });

  it('returns INSTALL_LIMIT_REACHED when at install limit', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');
    const { getSopInstallLimit } = await import('@/seed/config/tiers');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getSopInstallLimit).mockReturnValue(3);

    const limitD1 = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation(() => {
          if (sql.includes('SELECT COUNT(*)') && sql.includes('listing_id = ?')) {
            return {
              first: vi.fn().mockResolvedValue({ count: 0 }),
            };
          }
          if (sql.includes('SELECT COUNT(*)')) {
            return {
              first: vi.fn().mockResolvedValue({ count: 3 }),
            };
          }
          return {
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [], success: true }),
            run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
          };
        }),
        run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [], success: true }),
      })),
    } as unknown as D1Database;

    vi.mocked(getD1).mockResolvedValue(limitD1);
    vi.mocked(getSopListing).mockResolvedValue(mockFreeListing as never);

    const result = await installSop('listing-free-001');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INSTALL_LIMIT_REACHED');
    }
  });
});

describe('uninstallSop & Reinstall Support', () => {
  it('returns success for valid owner', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopInstall } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopInstall).mockResolvedValue(mockInstall as never);

    const result = await uninstallSop('license-abc-123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.success).toBe(true);
    }
  });

  it('returns NOT_OWNER when user does not own the install', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopInstall } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopInstall).mockResolvedValue({
      ...mockInstall,
      user_id: 'different-user',
    } as never);

    const result = await uninstallSop('license-abc-123');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_OWNER');
    }
  });

  it('6. reinstall after uninstall succeeds because only status = active rows count as duplicate', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue(mockFreeListing as never);
    vi.mocked(dbCreateSopInstall).mockResolvedValue({
      ...mockInstall,
      id: 'install-new-002',
      license_id: 'license-new-456',
    } as never);

    const result = await installSop('listing-free-001');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.licenseId).toBeDefined();
    }
  });
});

describe('Creator & Admin Publishing Gates for Paid Listings', () => {
  it('5a. creator cannot publish listing if price_cents > 0', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing, getCreatorProfile } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue({
      ...mockPaidListing,
      status: 'draft',
    } as never);
    vi.mocked(getCreatorProfile).mockResolvedValue(mockCreatorProfile as never);

    const result = await publishListing('listing-paid-001');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('checkout is enabled');
    }
  });

  it('5b. creator cannot update listing to published if price_cents > 0', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing, getCreatorProfile } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue({
      ...mockPaidListing,
      status: 'draft',
    } as never);
    vi.mocked(getCreatorProfile).mockResolvedValue(mockCreatorProfile as never);

    const result = await updateSopListing('listing-paid-001', {
      status: 'published',
      priceCents: 9900,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('checkout is enabled');
    }
  });

  it('5c. admin cannot approve listing if price_cents > 0', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue({
      ...mockPaidListing,
      status: 'pending_review',
    } as never);

    const result = await approveListingAdmin('listing-paid-001');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('checkout is enabled');
    }
  });
});
