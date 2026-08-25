/**
 * Unit tests for asset-performance.ts server action.
 *
 * Covers: auth guard, validation, membership check (cross-tenant),
 * happy path aggregation with ROI, empty result, and internal error.
 *
 * @module land/creative-economy/__tests__/asset-performance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockPrepare = vi.fn().mockReturnThis();
const mockBind = vi.fn().mockReturnThis();
const mockFirst = vi.fn();
const mockAll = vi.fn();

const fakeDb = {
  prepare: mockPrepare,
  bind: mockBind,
  first: mockFirst,
  all: mockAll,
  run: vi.fn(),
  execute: vi.fn(),
};

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => fakeDb,
}));

import { getAssetPerformance } from '../asset-performance';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

const mockUser = { id: 'user-001', email: 'ceo@test.com' };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnThis();
  mockBind.mockReturnThis();
});

describe('getAssetPerformance', () => {
  it('returns VALIDATION_ERROR for empty workspaceId', async () => {
    const result = await getAssetPerformance({ workspaceId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_AUTHENTICATED when no user session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getAssetPerformance({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_AUTHENTICATED');
    }
  });

  it('returns FORBIDDEN when user is not a workspace member', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce(null);

    const result = await getAssetPerformance({ workspaceId: 'other-ws' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('returns success with aggregated assets and computed ROI', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({}); // membership
    mockAll.mockResolvedValueOnce({
      results: [
        {
          asset_id: 'asset-001',
          project_id: 'proj-001',
          channel: 'youtube',
          impressions: 1000,
          revenue_cents: 5000,
          cost_cents: 2000,
        },
      ],
    });

    const result = await getAssetPerformance({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      const asset = result.value[0];
      expect(asset.assetId).toBe('asset-001');
      expect(asset.impressions).toBe(1000);
      expect(asset.revenueCents).toBe(5000);
      expect(asset.costCents).toBe(2000);
      // ROI = (5000 - 2000) / 2000 * 100 = 150%
      expect(asset.roiPct).toBe(150);
    }
  });

  it('returns null ROI when cost is zero', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    mockAll.mockResolvedValueOnce({
      results: [
        {
          asset_id: 'asset-002',
          project_id: null,
          channel: null,
          impressions: 0,
          revenue_cents: 1000,
          cost_cents: 0,
        },
      ],
    });

    const result = await getAssetPerformance({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const asset = result.value[0];
      expect(asset.roiPct).toBeNull();
      expect(asset.projectId).toBe('');
      expect(asset.channel).toBe('unknown');
    }
  });

  it('returns empty array when no assets exist', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    mockAll.mockResolvedValueOnce({ results: [] });

    const result = await getAssetPerformance({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('returns INTERNAL on unexpected database error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockRejectedValueOnce(new Error('D1 error'));

    const result = await getAssetPerformance({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
    }
  });
});

