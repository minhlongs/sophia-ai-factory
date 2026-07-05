import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRevenueInsights, getRecentTransactions } from '../actions';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const tierByUser = new Map<string, string>();
tierByUser.set('user-premium', 'PREMIUM');
tierByUser.set('user-basic', 'BASIC');

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(async (userId?: string) => {
    if (userId === 'user-basic') return { id: 'user-basic' };
    return { id: 'user-premium' };
  }),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(async (userId: string) => tierByUser.get(userId) ?? 'BASIC'),
}));

const fakeRows: Array<{ id: string; date: number; amount_cents: number; credits_total: number; sku: string; status: string }> = [
  { id: 'tx-1', date: Math.floor(Date.now() / 1000) - 3600, amount_cents: 2000, credits_total: 100, sku: 'STARTER', status: 'paid' },
];

function makePrepare(returnValues: Array<{ results?: any[]; first?: any }>) {
  let idx = 0;
  return () => {
    const rv = returnValues[idx++] ?? {};
    return {
      bind: () => ({
        first: vi.fn(async () => rv.first ?? null),
        all: vi.fn(async () => ({ results: rv.results ?? [] })),
      }),
    };
  };
}

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => ({
    prepare: makePrepare([
      { first: { spent_cents: 2000, credits_total: 100 } },
      { results: fakeRows },
      { results: [{ date: new Date().toISOString().slice(0, 10), spent_cents: 1000, credits_used: 50 }] },
      { first: { credits_remaining: 50 } },
    ]),
  })),
}));

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('revenue actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getRevenueInsights returns insights for PREMIUM user', async () => {
    const result = await getRevenueInsights();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insights).toBeDefined();
    if (!result.insights) return;
    expect(result.insights.tier).toBe('PREMIUM');
    expect(typeof result.insights.totalSpentUsd).toBe('number');
    expect(Array.isArray(result.insights.trend30d)).toBe(true);
  });

  it('getRevenueInsights returns insights for BASIC user', async () => {
    const { getCurrentUser: originalGetCurrentUser } = await import('@/seed/auth/better-auth-session');
    vi.mocked(originalGetCurrentUser).mockResolvedValueOnce({ id: 'user-basic' } as never);

    const result = await getRevenueInsights();

    // Tier gating happens in page.tsx; this layer simply reports the tier.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insights?.tier).toBe('BASIC');
  });

  it('getRecentTransactions returns transactions for PREMIUM user', async () => {
    const result = await getRecentTransactions();

    expect(result.ok).toBe(true);
    if (!result.ok || !result.transactions) return;
    expect(result.transactions.length).toBeGreaterThanOrEqual(1);
    expect(result.transactions[0].sku).toBe('STARTER');
  });

  it('returns auth_required when no user for insights', async () => {
    const { getCurrentUser: original } = await import('@/seed/auth/better-auth-session');
    vi.mocked(original).mockResolvedValueOnce(null as never);

    const insights = await getRevenueInsights();

    expect(insights.ok).toBe(false);
    expect(insights.error).toBe('auth_required');
  });

  it('returns auth_required when no user for transactions', async () => {
    const { getCurrentUser: original } = await import('@/seed/auth/better-auth-session');
    vi.mocked(original).mockResolvedValueOnce(null as never);

    const txs = await getRecentTransactions();

    expect(txs.ok).toBe(false);
    expect(txs.error).toBe('auth_required');
  });
});
