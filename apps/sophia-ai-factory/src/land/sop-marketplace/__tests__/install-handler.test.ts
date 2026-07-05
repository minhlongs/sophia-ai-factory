/**
 * Tests for SOP Installation Handler Server Actions
 *
 * Unit tests for installSop and uninstallSop by mocking auth, DB,
 * tier config, and marketplace-ops dependencies. Validates that
 * each error code path produces the correct Result.
 *
 * @module land/sop-marketplace/__tests__/install-handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';

// ── Module-level mocks ─────────────────────────────────────────────────────

const mockUser = { id: 'user-test-001', email: 'test@example.com' };
const mockListing = {
  id: 'listing-001',
  creator_id: 'creator-001',
  sop_template_id: 'tpl-001',
  price_cents: 9900,
  status: 'published',
  title: 'Test SOP',
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
const mockInstall = {
  id: 'install-001',
  listing_id: 'listing-001',
  user_id: 'user-test-001',
  license_id: 'license-abc-123',
  price_cents: 9900,
  commission_id: 'comm-001',
  status: 'active',
  installed_at: 2000000,
  uninstalled_at: null,
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

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn().mockResolvedValue('PREMIUM'),
}));

vi.mock('@/seed/config/tiers', () => ({
  getSopInstallLimit: vi.fn().mockReturnValue(10),
}));

vi.mock('@/seed/db/marketplace-ops', () => ({
  getSopListing: vi.fn(),
  getSopInstall: vi.fn(),
  createSopInstall: vi.fn(),
}));

vi.mock('../commission-split', () => ({
  calculateCreatorCommission: vi
    .fn()
    .mockReturnValue({
      grossCents: 9900,
      creatorCents: 6930,
      platformCents: 2970,
      commissionPct: 0.7,
    }),
  recordSopSaleCommission: vi.fn().mockResolvedValue('comm-001'),
}));

// Now import the module under test (must be after vi.mock)
import { installSop, uninstallSop } from '../install-handler';

beforeEach(async () => {
  vi.clearAllMocks();
  d1Calls.length = 0;
  const { requireOrgMembership: orgCheck } = await import('@/seed/db/org-membership');
  vi.mocked(orgCheck).mockResolvedValue({ authorized: true, orgId: 'test-org', role: 'owner' });
});

describe('installSop', () => {
  it('returns success with valid auth and valid published listing', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockReturnValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue(mockListing as any);

    const result = await installSop('listing-001');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.licenseId).toBeDefined();
    }
  });

  it('returns NOT_AUTHENTICATED when no user', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await installSop('listing-001');

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
    vi.mocked(getD1).mockReturnValue(makeD1Mock() as unknown as D1Database);
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
    vi.mocked(getD1).mockReturnValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopListing).mockResolvedValue({ ...mockListing, status: 'draft' } as any);

    const result = await installSop('listing-draft');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('LISTING_NOT_PUBLISHED');
    }
  });

  it('returns ALREADY_INSTALLED for duplicate installs', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopListing } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockResolvedValue(makeD1Mock() as unknown as D1Database);

    // For duplicate check, override the COUNT mock to return 1
    const duplicateD1 = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation((...binds: unknown[]) => {
          // Duplicate: return count=1
          if (sql.includes('SELECT COUNT(*)') && sql.includes('listing_id = ?')) {
            return {
              first: vi.fn().mockResolvedValue({ count: 1 }),
            };
          }
          if (sql.includes('SELECT COUNT(*)') && sql.includes('status')) {
            return {
              first: vi.fn().mockResolvedValue({ count: 0 }),
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

    vi.mocked(getD1).mockReturnValue(duplicateD1);
    vi.mocked(getSopListing).mockResolvedValue(mockListing as any);

    const result = await installSop('listing-001');

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
        bind: vi.fn().mockImplementation((...binds: unknown[]) => {
          // Duplicate check (has listing_id = ?) — return count 0 (not a duplicate)
          if (sql.includes('SELECT COUNT(*)') && sql.includes('listing_id = ?')) {
            return {
              first: vi.fn().mockResolvedValue({ count: 0 }),
            };
          }
          // Active count (no listing_id filter) — return at limit (3)
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

    vi.mocked(getD1).mockReturnValue(limitD1);
    vi.mocked(getSopListing).mockResolvedValue(mockListing as any);

    const result = await installSop('listing-001');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INSTALL_LIMIT_REACHED');
    }
  });
});

describe('uninstallSop', () => {
  it('returns success for valid owner', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getSopInstall } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockReturnValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopInstall).mockResolvedValue(mockInstall as any);

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
    vi.mocked(getD1).mockReturnValue(makeD1Mock() as unknown as D1Database);
    vi.mocked(getSopInstall).mockResolvedValue({
      ...mockInstall,
      user_id: 'different-user',
    } as any);

    const result = await uninstallSop('license-abc-123');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_OWNER');
    }
  });
});
