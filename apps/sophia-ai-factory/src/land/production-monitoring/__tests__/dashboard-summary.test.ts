/**
 * Unit tests for production-monitoring dashboard-summary.
 *
 * Deterministic: DB client is mocked. Covers the six KPIs (happy path,
 * empty database, median odd/even) and pending-approvals mapping.
 *
 * @module land/production-monitoring/__tests__/dashboard-summary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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
};

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => fakeDb,
}));

import {
  getProductionDashboardSummary,
  getPendingApprovals,
} from '../dashboard-summary';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnThis();
  mockBind.mockReturnThis();
});

describe('getProductionDashboardSummary', () => {
  it('computes all six KPIs from run + approval aggregates', async () => {
    mockFirst
      // run aggregate: 6 completed (2 retried), 4 failed, 3 active, 1000 cents terminal spend
      .mockResolvedValueOnce({
        completed_count: 6,
        failed_count: 4,
        retried_completed_count: 2,
        terminal_cost_cents: 1000,
        active_runs: 3,
      })
      // pending approvals count
      .mockResolvedValueOnce({ pending_count: 5 });
    // approval durations (seconds), ascending: 3600s=1h, 7200s=2h, 14400s=4h → median 2h
    mockAll.mockResolvedValueOnce({
      results: [{ duration_sec: 3600 }, { duration_sec: 7200 }, { duration_sec: 14400 }],
    });

    const result = await getProductionDashboardSummary('ws-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.completionPct).toBe(60); // 6/(6+4)
      expect(result.value.approvalTurnaroundMedianHours).toBe(2);
      expect(result.value.retrySuccessPct).toBe(33.3); // 2/6
      expect(result.value.avgSpendPerRunCents).toBe(100); // 1000/10
      expect(result.value.activeRuns).toBe(3);
      expect(result.value.pendingApprovals).toBe(5);
    }
  });

  it('returns null ratios and zero counts on an empty database', async () => {
    mockFirst
      .mockResolvedValueOnce({
        completed_count: null,
        failed_count: null,
        retried_completed_count: null,
        terminal_cost_cents: null,
        active_runs: null,
      })
      .mockResolvedValueOnce({ pending_count: null });
    mockAll.mockResolvedValueOnce({ results: [] });

    const result = await getProductionDashboardSummary('ws-empty');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.completionPct).toBeNull();
      expect(result.value.approvalTurnaroundMedianHours).toBeNull();
      expect(result.value.retrySuccessPct).toBeNull();
      expect(result.value.avgSpendPerRunCents).toBeNull();
      expect(result.value.activeRuns).toBe(0);
      expect(result.value.pendingApprovals).toBe(0);
    }
  });

  it('computes even-length median as the mean of the two middle values', async () => {
    mockFirst
      .mockResolvedValueOnce({
        completed_count: 1,
        failed_count: 0,
        retried_completed_count: 0,
        terminal_cost_cents: 0,
        active_runs: 0,
      })
      .mockResolvedValueOnce({ pending_count: 0 });
    // 1h and 3h → median 2h
    mockAll.mockResolvedValueOnce({
      results: [{ duration_sec: 3600 }, { duration_sec: 10800 }],
    });

    const result = await getProductionDashboardSummary('ws-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.approvalTurnaroundMedianHours).toBe(2);
    }
  });

  it('returns INTERNAL on unexpected database error', async () => {
    mockFirst.mockRejectedValueOnce(new Error('D1 connection lost'));

    const result = await getProductionDashboardSummary('ws-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
      expect(result.error.message).toBe('D1 connection lost');
    }
  });

  it('binds workspaceId to every query (workspace scoping)', async () => {
    mockFirst
      .mockResolvedValueOnce({
        completed_count: 0,
        failed_count: 0,
        retried_completed_count: 0,
        terminal_cost_cents: 0,
        active_runs: 0,
      })
      .mockResolvedValueOnce({ pending_count: 0 });
    mockAll.mockResolvedValueOnce({ results: [] });

    await getProductionDashboardSummary('ws-scoped');

    for (const call of mockBind.mock.calls) {
      expect(call[0]).toBe('ws-scoped');
    }
  });
});

describe('getPendingApprovals', () => {
  it('maps rows and converts second timestamps to milliseconds', async () => {
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: 'appr-1',
          agent_run_id: 'run-1',
          action_type: 'publish_content',
          action_summary: 'Publish article',
          estimated_cost_cents: 250,
          created_at: 1700000000,
          timeout_at: 1700003600,
        },
      ],
    });

    const result = await getPendingApprovals('ws-1', 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toEqual({
        id: 'appr-1',
        agentRunId: 'run-1',
        actionType: 'publish_content',
        actionSummary: 'Publish article',
        estimatedCostCents: 250,
        createdAtMs: 1700000000000,
        timeoutAtMs: 1700003600000,
      });
    }
  });

  it('keeps null timeout and cost as null', async () => {
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: 'appr-2',
          agent_run_id: 'run-2',
          action_type: 'publish_content',
          action_summary: 'Publish video',
          estimated_cost_cents: null,
          created_at: 1700000000,
          timeout_at: null,
        },
      ],
    });

    const result = await getPendingApprovals('ws-1', 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].estimatedCostCents).toBeNull();
      expect(result.value[0].timeoutAtMs).toBeNull();
    }
  });

  it('returns an empty list when nothing is pending', async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    const result = await getPendingApprovals('ws-1', 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('returns INTERNAL on unexpected database error', async () => {
    mockAll.mockRejectedValueOnce(new Error('query failed'));

    const result = await getPendingApprovals('ws-1', 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
    }
  });
});
