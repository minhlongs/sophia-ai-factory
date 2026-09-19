import { describe, it, expect, vi, beforeEach } from 'vitest';
import { harvestInstagramReelsMetrics } from '../instagram-metrics-harvester';

const mocks = vi.hoisted(() => ({
  mockD1Prepare: vi.fn(),
  mockGetMetrics: vi.fn(),
  mockUpsertVideoAnalytics: vi.fn(),
  mockRecordPerformanceEventIdempotent: vi.fn(),
  mockDecryptToken: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockImplementation(async () => ({
    prepare: mocks.mockD1Prepare,
  })),
}));

vi.mock('@/seed/db/repositories/video-analytics-repo', () => ({
  upsertVideoAnalytics: mocks.mockUpsertVideoAnalytics,
}));

vi.mock('@/tree/performance/events', () => ({
  recordPerformanceEventIdempotent: mocks.mockRecordPerformanceEventIdempotent,
}));

vi.mock('@/tree/crypto/token-crypto', () => ({
  decryptToken: mocks.mockDecryptToken,
}));

vi.mock('@/forest/publishing/oauth-platform-refreshers', () => ({
  refreshInstagramLongLivedToken: vi.fn().mockResolvedValue({ access_token: 'refreshed-tok', expires_in: 5184000 }),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('harvestInstagramReelsMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockDecryptToken.mockResolvedValue('decrypted-ig-token');
    mocks.mockUpsertVideoAnalytics.mockResolvedValue(undefined);
    mocks.mockRecordPerformanceEventIdempotent.mockResolvedValue(true);
  });

  it('returns 0 when no published Instagram reels found', async () => {
    mocks.mockD1Prepare.mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    });

    const result = await harvestInstagramReelsMetrics({ fetchMetrics: mocks.mockGetMetrics });
    expect(result).toEqual({ totalFound: 0, harvested: 0, errors: 0 });
    expect(mocks.mockGetMetrics).not.toHaveBeenCalled();
  });

  it('harvests metrics, updates publishing_results, video_analytics, and performance_events', async () => {
    const postRows = [
      {
        tenant_id: 'tenant-ig-1',
        video_id: 'vid-reel-1',
        channel_post_id: 'ig-post-123',
        channel_id: 'ch-ig-1',
        access_token: 'enc-tok-1',
        external_account_id: 'ig-user-1',
      },
    ];

    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    mocks.mockD1Prepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT DISTINCT')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: postRows }),
          }),
        };
      }
      return {
        bind: vi.fn().mockReturnValue({
          run: mockRun,
        }),
      };
    });

    mocks.mockGetMetrics.mockResolvedValueOnce({
      views: 1250,
      reach: 1100,
      likes: 180,
      comments: 25,
      shares: 14,
    });

    const result = await harvestInstagramReelsMetrics({
      limit: 10,
      fetchMetrics: mocks.mockGetMetrics,
    });

    expect(result.totalFound).toBe(1);
    expect(result.harvested).toBe(1);
    expect(result.errors).toBe(0);

    // 1. Instagram metrics fetched with token & post ID
    expect(mocks.mockGetMetrics).toHaveBeenCalledWith('decrypted-ig-token', 'ig-post-123');

    // 2. Video analytics upserted
    expect(mocks.mockUpsertVideoAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tenant-ig-1',
        videoId: 'vid-reel-1',
        platform: 'instagram',
        platformVideoId: 'ig-post-123',
        views: 1250,
        likes: 180,
        comments: 25,
        shares: 14,
      }),
    );

    // 3. Performance event recorded with channel='instagram' and eventType='engagement'
    expect(mocks.mockRecordPerformanceEventIdempotent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'tenant-ig-1',
        assetId: 'vid-reel-1',
        channel: 'instagram',
        eventType: 'engagement',
        count: 1250,
        rawData: expect.objectContaining({
          views: 1250,
          reach: 1100,
          likes: 180,
          comments: 25,
          shares: 14,
          source: 'instagram-harvester',
        }),
      }),
    );
  });

  it('handles post errors gracefully without aborting the batch', async () => {
    const postRows = [
      { tenant_id: 't-1', video_id: 'v-1', channel_post_id: 'bad-post', access_token: 'enc-1' },
      { tenant_id: 't-1', video_id: 'v-2', channel_post_id: 'good-post', access_token: 'enc-1' },
    ];

    mocks.mockD1Prepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT DISTINCT')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: postRows }),
          }),
        };
      }
      return {
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      };
    });

    // First post throws, second succeeds
    mocks.mockGetMetrics
      .mockRejectedValueOnce(new Error('Instagram API 404'))
      .mockResolvedValueOnce({ views: 50, reach: 45, likes: 5, comments: 1, shares: 0 });

    const result = await harvestInstagramReelsMetrics({ fetchMetrics: mocks.mockGetMetrics });

    expect(result.totalFound).toBe(2);
    expect(result.harvested).toBe(1);
    expect(result.errors).toBe(1);
  });
});
