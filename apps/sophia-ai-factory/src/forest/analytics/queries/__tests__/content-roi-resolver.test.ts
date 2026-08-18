/**
 * Tests for content-roi-resolver — joins content_projects + roi_records + performance_events.
 *
 * Uses the global D1 mock from test/setup.tsx.
 * Verifies: ROI calculation, zero-data handling, channel breakdown, graceful error recovery.
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

describe('resolveContentRoi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getD1Mock().prepare.mockReturnValue(chainResult([]));
  });

  it('returns hasData: false when workspace has no projects', async () => {
    const { resolveContentRoi } = await import('../content-roi-resolver');
    const result = await resolveContentRoi('ws_123');
    expect(result.hasData).toBe(false);
    expect(result.projects).toHaveLength(0);
    expect(result.totalRevenueCents).toBe(0);
  });

  it('returns empty workspace for empty workspaceId', async () => {
    const { resolveContentRoi } = await import('../content-roi-resolver');
    const result = await resolveContentRoi('');
    expect(result.hasData).toBe(false);
    expect(result.projects).toHaveLength(0);
  });

  it('returns hasData: true when projects have revenue', async () => {
    getD1Mock().prepare.mockReturnValue(chainResult([
      {
        content_project_id: 'proj_1',
        workspace_id: 'ws_1',
        title: 'Test Campaign',
        budget_cents: 5000,
        revenue_cents: 10000,
        cost_cents: 5000,
        roi: 2.0,
        events: 3,
        channel: 'youtube',
        ch_revenue: 7000,
        ch_cost: 3000,
        ch_roi: 2.33,
        ch_events: 2,
      },
      {
        content_project_id: 'proj_1',
        workspace_id: 'ws_1',
        title: 'Test Campaign',
        budget_cents: 5000,
        revenue_cents: 10000,
        cost_cents: 5000,
        roi: 2.0,
        events: 3,
        channel: 'tiktok',
        ch_revenue: 3000,
        ch_cost: 2000,
        ch_roi: 1.5,
        ch_events: 1,
      },
    ]));

    const { resolveContentRoi } = await import('../content-roi-resolver');
    const result = await resolveContentRoi('ws_1');
    expect(result.hasData).toBe(true);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].channels).toHaveLength(2);
    expect(result.totalRevenueCents).toBe(10000);
    expect(result.totalCostCents).toBe(5000);
  });

  it('handles projects with no ROI data but has performance events', async () => {
    getD1Mock().prepare.mockReturnValue(chainResult([
      {
        content_project_id: 'proj_empty',
        workspace_id: 'ws_1',
        title: 'New Campaign',
        budget_cents: 0,
        revenue_cents: 0,
        cost_cents: 0,
        roi: 0,
        events: 5,
        channel: null,
        ch_revenue: null,
        ch_cost: null,
        ch_roi: null,
        ch_events: null,
      },
    ]));

    const { resolveContentRoi } = await import('../content-roi-resolver');
    const result = await resolveContentRoi('ws_1');
    expect(result.hasData).toBe(true);
    expect(result.projects[0].hasData).toBe(true);
    expect(result.projects[0].events).toBe(5);
    expect(result.projects[0].channels).toHaveLength(0);
  });

  it('returns hasData: false when D1 is unavailable', async () => {
    vi.doMock('@/seed/db/client', () => ({ getD1: () => null }));
    vi.resetModules();
    const { resolveContentRoi } = await import('../content-roi-resolver');
    const result = await resolveContentRoi('ws_1');
    expect(result.hasData).toBe(false);
    vi.doUnmock('@/seed/db/client');
  });

  it('returns hasData: false when query throws', async () => {
    getD1Mock().prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockRejectedValue(new Error('D1 query failed')),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
    });

    const { resolveContentRoi } = await import('../content-roi-resolver');
    const result = await resolveContentRoi('ws_1');
    expect(result.hasData).toBe(false);
  });

  it('computes correct workspace-level ROI from multiple projects', async () => {
    vi.resetModules();
    getD1Mock().prepare.mockReturnValue(chainResult([
      {
        content_project_id: 'proj_a', workspace_id: 'ws_1', title: 'A',
        budget_cents: 1000, revenue_cents: 3000, cost_cents: 1000, roi: 3.0,
        events: 2, channel: 'youtube', ch_revenue: 3000, ch_cost: 1000, ch_roi: 3.0, ch_events: 2,
      },
      {
        content_project_id: 'proj_b', workspace_id: 'ws_1', title: 'B',
        budget_cents: 2000, revenue_cents: 1000, cost_cents: 2000, roi: 0.5,
        events: 1, channel: 'instagram', ch_revenue: 1000, ch_cost: 2000, ch_roi: 0.5, ch_events: 1,
      },
    ]));

    const { resolveContentRoi } = await import('../content-roi-resolver');
    const result = await resolveContentRoi('ws_1');
    expect(result.projects).toHaveLength(2);
    expect(result.totalRevenueCents).toBe(4000);
    expect(result.totalCostCents).toBe(3000);
    expect(result.roi).toBeCloseTo(1.33, 1);
  });
});
