/**
 * Unit tests: YouTube Analytics fetcher — 11-column positional parsing.
 * estimatedRevenue (micro USD) is appended LAST in METRICS (index 10);
 * existing fields keep indices 0-9.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn(() => true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { fetchYouTubeAnalytics } from '../youtube-analytics-fetcher';

const RANGE = { start: '2026-07-26', end: '2026-08-25' };

// 11 columns: video, day, views, estimatedMinutesWatched, averageViewDuration,
// impressions, impressionClickThroughRate, likes, comments, shares, estimatedRevenue
const ROW_11: [string, string, ...number[]] = [
  'vid-abc', '2026-08-01', 100, 600, 6, 5000, 4.5, 10, 3, 2, 2_500_000,
];

function mockFetchOk(rows: unknown[][]) {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        columnHeaders: [
          { name: 'video' }, { name: 'day' }, { name: 'views' },
          { name: 'estimatedMinutesWatched' }, { name: 'averageViewDuration' },
          { name: 'impressions' }, { name: 'impressionClickThroughRate' },
          { name: 'likes' }, { name: 'comments' }, { name: 'shares' },
          { name: 'estimatedRevenue' },
        ],
        rows,
      }),
      { status: 200 },
    ),
  );
}

describe('fetchYouTubeAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests estimatedRevenue as the last metric', async () => {
    vi.stubGlobal('fetch', mockFetchOk([]));
    await fetchYouTubeAnalytics('token', ['vid-abc'], RANGE);

    const calledUrl = new URL(vi.mocked(fetch).mock.calls[0]?.[0] as string);
    const metrics = calledUrl.searchParams.get('metrics') ?? '';
    expect(metrics.endsWith('estimatedRevenue')).toBe(true);
    expect(metrics.split(',')).toHaveLength(9);
  });

  it('parses all 11 columns positionally (indices 0-10)', async () => {
    vi.stubGlobal('fetch', mockFetchOk([ROW_11]));
    const rows = await fetchYouTubeAnalytics('token', ['vid-abc'], RANGE);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      videoId: 'vid-abc',
      date: '2026-08-01',
      views: 100,
      estimatedMinutesWatched: 600,
      averageViewDuration: 6,
      impressions: 5000,
      impressionClickThroughRate: 4.5,
      likes: 10,
      comments: 3,
      shares: 2,
      estimatedRevenue: 2_500_000,
    });
  });

  it('defaults estimatedRevenue to 0 when the 11th column is missing', async () => {
    const rowWithoutRevenue: [string, string, ...number[]] = [
      'vid-abc', '2026-08-01', 100, 600, 6, 5000, 4.5, 10, 3, 2,
    ];
    vi.stubGlobal('fetch', mockFetchOk([rowWithoutRevenue]));
    const rows = await fetchYouTubeAnalytics('token', ['vid-abc'], RANGE);

    expect(rows[0]?.estimatedRevenue).toBe(0);
    expect(rows[0]?.views).toBe(100);
  });

  it('returns empty array for empty response rows', async () => {
    vi.stubGlobal('fetch', mockFetchOk([]));
    const rows = await fetchYouTubeAnalytics('token', ['vid-abc'], RANGE);
    expect(rows).toEqual([]);
  });

  it('returns empty array without fetching when no video ids given', async () => {
    const fetchMock = mockFetchOk([]);
    vi.stubGlobal('fetch', fetchMock);
    const rows = await fetchYouTubeAnalytics('token', [], RANGE);
    expect(rows).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
