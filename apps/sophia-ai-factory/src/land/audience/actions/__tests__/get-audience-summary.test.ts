/**
 * getAudienceSummary server action tests — auth, validation, membership,
 * happy path, empty state, and internal error handling.
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

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    prepare: mockPrepare,
    bind: mockBind,
    first: mockFirst,
  }),
}));

const mockListSegments = vi.fn();
const mockGetLatestMetrics = vi.fn();

vi.mock('@/tree/audience/audience-segments', () => ({
  listSegments: (...args: unknown[]) => mockListSegments(...args),
}));

vi.mock('@/tree/audience/metrics-store', () => ({
  getLatestMetrics: (...args: unknown[]) => mockGetLatestMetrics(...args),
}));

import { getAudienceSummary } from '../get-audience-summary';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

const mockUser = { id: 'user-001', email: 'ceo@test.com' };

const segment = {
  id: 'seg_1',
  workspaceId: 'ws-1',
  name: 'Gen-Z shorts fans',
  platforms: ['tiktok'],
  contentTypes: ['short_video'],
  ageBuckets: ['18-24'],
  countries: [],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

const metricsRow = {
  id: 'am_1',
  workspaceId: 'ws-1',
  platform: 'tiktok',
  followers: 4000,
  engagementRate: 0.04,
  demographics: {},
  windowStartMs: 1_700_000_000_000,
  windowEndMs: 1_700_086_400_000,
  createdAt: 1_700_086_400_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnThis();
  mockBind.mockReturnThis();
});

describe('getAudienceSummary', () => {
  it('returns VALIDATION_ERROR for empty workspaceId', async () => {
    const result = await getAudienceSummary({ workspaceId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns NOT_AUTHENTICATED when no user session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getAudienceSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns FORBIDDEN when user is not a workspace member', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce(null);
    const result = await getAudienceSummary({ workspaceId: 'other-ws' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('returns segments + metrics summary for a valid workspace', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({}); // membership
    mockListSegments.mockResolvedValueOnce({ ok: true, value: [segment] });
    mockGetLatestMetrics.mockResolvedValueOnce({ ok: true, value: [metricsRow] });

    const result = await getAudienceSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.segments).toHaveLength(1);
      expect(result.value.metrics).toHaveLength(1);
      expect(result.value.totalFollowers).toBe(4000);
      expect(result.value.averageEngagementRate).toBeCloseTo(0.04, 6);
    }
  });

  it('returns an empty-state success (not an error) when no data exists', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    mockListSegments.mockResolvedValueOnce({ ok: true, value: [] });
    mockGetLatestMetrics.mockResolvedValueOnce({ ok: true, value: [] });

    const result = await getAudienceSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.segments).toEqual([]);
      expect(result.value.metrics).toEqual([]);
      expect(result.value.totalFollowers).toBe(0);
      expect(result.value.averageEngagementRate).toBe(0);
    }
  });

  it('averages engagement across multiple platforms', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    mockListSegments.mockResolvedValueOnce({ ok: true, value: [] });
    mockGetLatestMetrics.mockResolvedValueOnce({
      ok: true,
      value: [metricsRow, { ...metricsRow, id: 'am_2', platform: 'youtube', engagementRate: 0.08 }],
    });

    const result = await getAudienceSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.averageEngagementRate).toBeCloseTo(0.06, 6);
      expect(result.value.totalFollowers).toBe(8000);
    }
  });

  it('returns INTERNAL when the segment query fails', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    mockListSegments.mockResolvedValueOnce({ ok: false, error: { code: 'QUERY_FAILED', message: 'boom' } });
    mockGetLatestMetrics.mockResolvedValueOnce({ ok: true, value: [] });

    const result = await getAudienceSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
  });

  it('returns INTERNAL on unexpected database error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockRejectedValueOnce(new Error('D1 connection lost'));

    const result = await getAudienceSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
      expect(result.error.message).toBe('D1 connection lost');
    }
  });

  it('binds workspaceId + userId to the membership query (IDOR prevention)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    mockListSegments.mockResolvedValueOnce({ ok: true, value: [] });
    mockGetLatestMetrics.mockResolvedValueOnce({ ok: true, value: [] });

    await getAudienceSummary({ workspaceId: 'ws-specific' });
    expect(mockBind.mock.calls[0]).toContain('ws-specific');
    expect(mockBind.mock.calls[0]).toContain('user-001');
  });
});
