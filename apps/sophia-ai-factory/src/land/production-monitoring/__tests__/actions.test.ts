/**
 * Unit tests for production-monitoring server action boundary.
 *
 * Covers: Zod validation, auth guard, membership check (cross-tenant),
 * happy-path delegation to the summary module, and internal error handling.
 *
 * @module land/production-monitoring/__tests__/actions
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
};

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => fakeDb,
}));

import { getDashboardSummaryAction } from '../actions';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

const mockUser = { id: 'user-001', email: 'ceo@test.com' };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnThis();
  mockBind.mockReturnThis();
});

describe('getDashboardSummaryAction', () => {
  it('returns VALIDATION_ERROR for empty workspaceId', async () => {
    const result = await getDashboardSummaryAction({ workspaceId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_AUTHENTICATED when no user session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getDashboardSummaryAction({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_AUTHENTICATED');
    }
  });

  it('returns FORBIDDEN when user is not a workspace member (cross-tenant isolation)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce(null); // membership check returns null

    const result = await getDashboardSummaryAction({ workspaceId: 'other-ws' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('returns the six KPIs for a valid workspace member', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst
      .mockResolvedValueOnce({}) // membership check
      .mockResolvedValueOnce({
        completed_count: 9,
        failed_count: 1,
        retried_completed_count: 9,
        terminal_cost_cents: 500,
        active_runs: 2,
      })
      .mockResolvedValueOnce({ pending_count: 1 });
    mockAll.mockResolvedValueOnce({ results: [{ duration_sec: 7200 }] });

    const result = await getDashboardSummaryAction({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.completionPct).toBe(90);
      expect(result.value.approvalTurnaroundMedianHours).toBe(2);
      expect(result.value.retrySuccessPct).toBe(100);
      expect(result.value.avgSpendPerRunCents).toBe(50);
      expect(result.value.activeRuns).toBe(2);
      expect(result.value.pendingApprovals).toBe(1);
    }
  });

  it('binds workspaceId + userId to the membership query for IDOR prevention', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        completed_count: 0,
        failed_count: 0,
        retried_completed_count: 0,
        terminal_cost_cents: 0,
        active_runs: 0,
      })
      .mockResolvedValueOnce({ pending_count: 0 });
    mockAll.mockResolvedValueOnce({ results: [] });

    await getDashboardSummaryAction({ workspaceId: 'ws-specific' });

    const bindCalls = mockBind.mock.calls;
    expect(bindCalls[0]).toContain('ws-specific');
    expect(bindCalls[0]).toContain('user-001');
  });

  it('returns INTERNAL on unexpected database error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockRejectedValueOnce(new Error('D1 connection lost'));

    const result = await getDashboardSummaryAction({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
      expect(result.error.message).toBe('D1 connection lost');
    }
  });
});
