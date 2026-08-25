/**
 * Unit tests for dashboard-summary.ts server action.
 *
 * Covers: auth guard, validation, membership check (cross-tenant),
 * happy path aggregation, empty result, and internal error handling.
 *
 * @module land/creative-economy/__tests__/dashboard-summary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Module-level mocks ─────────────────────────────────────────────────────

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

import { getDashboardSummary } from '../dashboard-summary';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

const mockUser = { id: 'user-001', email: 'ceo@test.com' };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnThis();
  mockBind.mockReturnThis();
});

describe('getDashboardSummary', () => {
  it('returns VALIDATION_ERROR for empty workspaceId', async () => {
    const result = await getDashboardSummary({ workspaceId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_AUTHENTICATED when no user session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getDashboardSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_AUTHENTICATED');
    }
  });

  it('returns FORBIDDEN when user is not a workspace member (cross-tenant isolation)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce(null); // membership check returns null

    const result = await getDashboardSummary({ workspaceId: 'other-ws' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('returns success with aggregated summary for valid workspace', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst
      .mockResolvedValueOnce({}) // membership check
      .mockResolvedValueOnce({ revenue_cents: 50000, cost_cents: 20000, event_count: 42 });

    const result = await getDashboardSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revenueCents).toBe(50000);
      expect(result.value.costCents).toBe(20000);
      expect(result.value.netCents).toBe(30000);
      expect(result.value.eventCount).toBe(42);
      expect(result.value.windowDays).toBe(30);
    }
  });

  it('returns zeros when no events exist in window', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst
      .mockResolvedValueOnce({}) // membership
      .mockResolvedValueOnce({ revenue_cents: null, cost_cents: null, event_count: 0 });

    const result = await getDashboardSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revenueCents).toBe(0);
      expect(result.value.costCents).toBe(0);
      expect(result.value.netCents).toBe(0);
      expect(result.value.eventCount).toBe(0);
    }
  });

  it('returns INTERNAL on unexpected database error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockRejectedValueOnce(new Error('D1 connection lost'));

    const result = await getDashboardSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
      expect(result.error.message).toBe('D1 connection lost');
    }
  });

  it('binds workspaceId to membership query for IDOR prevention', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    mockFirst.mockResolvedValueOnce({ revenue_cents: 0, cost_cents: 0, event_count: 0 });

    await getDashboardSummary({ workspaceId: 'ws-specific' });

    // First bind call should be the membership check with workspaceId + userId
    const bindCalls = mockBind.mock.calls;
    expect(bindCalls[0]).toContain('ws-specific');
    expect(bindCalls[0]).toContain('user-001');
  });
});

