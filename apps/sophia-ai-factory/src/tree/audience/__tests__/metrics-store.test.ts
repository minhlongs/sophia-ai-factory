/**
 * Metrics store tests — upsert idempotency SQL, validation, latest-per-platform.
 * D1 is mocked via vi.mock('@/seed/db/client').
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrepare = vi.fn().mockReturnThis();
const mockBind = vi.fn().mockReturnThis();
const mockRun = vi.fn();
const mockAll = vi.fn();

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    prepare: mockPrepare,
    bind: mockBind,
    run: mockRun,
    all: mockAll,
  }),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { upsertAudienceMetrics, getLatestMetrics } from '../metrics-store';

const baseMetrics = {
  workspaceId: 'ws-1',
  platform: 'tiktok' as const,
  followers: 5000,
  engagementRate: 0.05,
  demographics: { ageBuckets: { '18-24': 0.6 } },
  windowStartMs: 1_700_000_000_000,
  windowEndMs: 1_700_086_400_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnThis();
  mockBind.mockReturnThis();
});

describe('upsertAudienceMetrics', () => {
  it('uses an idempotent upsert keyed on workspace+platform+window', async () => {
    mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });
    const result = await upsertAudienceMetrics(baseMetrics);
    expect(result.ok).toBe(true);

    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT(workspace_id, platform, window_start_ms) DO UPDATE');
    // Bind order: id, workspace, platform, followers, engagement, demographics, start, end, created
    expect(mockBind.mock.calls[0][1]).toBe('ws-1');
    expect(mockBind.mock.calls[0][2]).toBe('tiktok');
    expect(mockBind.mock.calls[0][6]).toBe(1_700_000_000_000);
  });

  it('double-run of the same window issues the same upsert key (one row survives)', async () => {
    mockRun.mockResolvedValue({ meta: { changes: 1 } });
    await upsertAudienceMetrics(baseMetrics);
    await upsertAudienceMetrics({ ...baseMetrics, followers: 6000 });

    expect(mockRun).toHaveBeenCalledTimes(2);
    const firstKey = [mockBind.mock.calls[0][1], mockBind.mock.calls[0][2], mockBind.mock.calls[0][6]];
    const secondKey = [mockBind.mock.calls[1][1], mockBind.mock.calls[1][2], mockBind.mock.calls[1][6]];
    expect(secondKey).toEqual(firstKey);
  });

  it('rejects negative followers', async () => {
    const result = await upsertAudienceMetrics({ ...baseMetrics, followers: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('rejects engagement rate above 1', async () => {
    const result = await upsertAudienceMetrics({ ...baseMetrics, engagementRate: 1.5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('rejects a window where end is not after start', async () => {
    const result = await upsertAudienceMetrics({
      ...baseMetrics,
      windowEndMs: baseMetrics.windowStartMs,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('returns INSERT_FAILED when the DB write throws', async () => {
    mockRun.mockRejectedValueOnce(new Error('disk full'));
    const result = await upsertAudienceMetrics(baseMetrics);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INSERT_FAILED');
  });
});

describe('getLatestMetrics', () => {
  it('parses rows with demographics JSON', async () => {
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: 'am_1',
          workspace_id: 'ws-1',
          platform: 'tiktok',
          followers: 5000,
          engagement_rate: 0.05,
          demographics: '{"ageBuckets":{"18-24":0.6}}',
          window_start_ms: 1_700_000_000_000,
          window_end_ms: 1_700_086_400_000,
          created_at: 1_700_086_400_000,
        },
      ],
    });
    const result = await getLatestMetrics('ws-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].demographics.ageBuckets).toEqual({ '18-24': 0.6 });
      expect(result.value[0].windowStartMs).toBe(1_700_000_000_000);
    }
  });

  it('returns an empty array when no metrics exist', async () => {
    mockAll.mockResolvedValueOnce({ results: [] });
    const result = await getLatestMetrics('ws-empty');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it('returns QUERY_FAILED when the DB read throws', async () => {
    mockAll.mockRejectedValueOnce(new Error('no such table'));
    const result = await getLatestMetrics('ws-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('QUERY_FAILED');
  });
});
