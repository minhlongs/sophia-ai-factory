/**
 * Tests for getContentUnitAttribution — per-ContentProject ROI CTE.
 *
 * Verifies: unit-level ROI, zero-data handling, graceful error recovery.
 * Existing 6-CTE resolver (aggregateRevenueAttribution) tests remain in revenue-unified-query.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

function getD1Mock() {
  return ((globalThis as Record<string, unknown>).__env as Record<string, unknown>).DB as {
    prepare: ReturnType<typeof vi.fn>;
  };
}

function chainResult(results: unknown[]) {
  return {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results, success: true }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
  };
}

describe('getContentUnitAttribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getD1Mock().prepare.mockReturnValue(chainResult([]));
  });

  it('returns empty array when no data', async () => {
    const { getContentUnitAttribution } = await import('../revenue-attribution');
    const result = await getContentUnitAttribution('ws_1');
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty workspaceId', async () => {
    const { getContentUnitAttribution } = await import('../revenue-attribution');
    const result = await getContentUnitAttribution('');
    expect(result).toHaveLength(0);
  });

  it('returns unit attribution rows with correct ROI', async () => {
    getD1Mock().prepare.mockReturnValue(chainResult([
      {
        content_project_id: 'proj_1',
        workspace_id: 'ws_1',
        title: 'Campaign A',
        channel: 'youtube',
        clicks: 0,
        conversions: 0,
        revenue_cents: 5000,
        cost_cents: 2000,
        roi: 1.5,
        events: 3,
      },
      {
        content_project_id: 'proj_1',
        workspace_id: 'ws_1',
        title: 'Campaign A',
        channel: 'tiktok',
        clicks: 0,
        conversions: 0,
        revenue_cents: 3000,
        cost_cents: 1000,
        roi: 2.0,
        events: 1,
      },
    ]));

    const { getContentUnitAttribution } = await import('../revenue-attribution');
    const result = await getContentUnitAttribution('ws_1');
    expect(result).toHaveLength(2);
    expect(result[0].contentProjectId).toBe('proj_1');
    expect(result[0].title).toBe('Campaign A');
    expect(result[0].channel).toBe('youtube');
    expect(result[0].revenueCents).toBe(5000);
    expect(result[0].costCents).toBe(2000);
    expect(result[0].roi).toBe(1.5);
    expect(result[1].channel).toBe('tiktok');
  });

  it('returns empty array when D1 is unavailable', async () => {
    vi.doMock('@/seed/db/client', () => ({ getD1: () => null }));
    vi.resetModules();
    const { getContentUnitAttribution } = await import('../revenue-attribution');
    const result = await getContentUnitAttribution('ws_1');
    expect(result).toHaveLength(0);
    vi.doUnmock('@/seed/db/client');
  });

  it('returns empty array when query throws', async () => {
    getD1Mock().prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockRejectedValue(new Error('D1 failure')),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
    });

    const { getContentUnitAttribution } = await import('../revenue-attribution');
    const result = await getContentUnitAttribution('ws_1');
    expect(result).toHaveLength(0);
  });
});