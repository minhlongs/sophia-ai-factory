/**
 * Subscription Cancel Contract Tests
 *
 * Verifies cancellation sets end-of-period, resubscribe within grace period,
 * and error cases.
 *
 * @module land/billing/__tests__/subscription-cancel-contract
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock getCurrentUser ───────────────────────────────────────────────────
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'user_001', email: 'test@example.com' }),
}));

// ── Mock logger ───────────────────────────────────────────────────────────
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Configurable D1 mock ─────────────────────────────────────────────────
type D1Config = {
  orgId: string | null;
  subscription: Record<string, unknown> | null;
};

const d1Config: D1Config = {
  orgId: null,
  subscription: null,
};

function makeD1Mock() {
  return {
    prepare: vi.fn((_sql: string) => {
      const chain = {
        bind: vi.fn(() => chain),
        first: vi.fn(() => {
          if (_sql.includes('org_members')) return Promise.resolve(d1Config.orgId ? { org_id: d1Config.orgId } : null);
          if (_sql.includes('subscriptions')) return Promise.resolve(d1Config.subscription);
          return Promise.resolve(null);
        }),
        all: vi.fn(() => Promise.resolve({ results: [], success: true })),
        run: vi.fn(() => Promise.resolve({ success: true, meta: {} })),
      };
      return chain;
    }),
    batch: vi.fn(() => Promise.resolve([{ success: true, meta: {} }])),
  };
}

vi.mock('@/seed/db/client', () => ({
  getD1: () => makeD1Mock(),
}));

// ── Test data ─────────────────────────────────────────────────────────────

const ACTIVE_SUB = {
  id: 'sub_001', org_id: 'org_001', plan: 'premium', status: 'active',
  current_period_start: '2026-06-01T00:00:00Z',
  current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  cancel_at_period_end: 0,
  cancellation_date: null,
};

function makeCancelledSub(daysAgo: number) {
  return {
    ...ACTIVE_SUB,
    cancel_at_period_end: 1,
    cancellation_date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  };
}

describe('Subscription Cancel Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    d1Config.orgId = 'org_001';
    d1Config.subscription = ACTIVE_SUB;
  });

  // ── 1. cancel sets end_date to current period end ───────────────────────
  it('cancel sets end_date to current period end (not immediate)', async () => {
    const { cancelSubscription } = await import('@/land/billing/actions/cancel-subscription-action');
    const result = await cancelSubscription();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.endDate).toBe(ACTIVE_SUB.current_period_end);
      expect(result.value.remainingDays).toBeGreaterThan(0);
    }
  });

  // ── 2. resubscribe before end_date restores with same tier ──────────────
  it('resubscribe before end_date restores with same tier', async () => {
    d1Config.subscription = makeCancelledSub(5); // cancelled 5 days ago

    const { resubscribe } = await import('@/land/billing/actions/resubscribe-action');
    const result = await resubscribe();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tier).toBe('PREMIUM');
      expect(result.value.nextBillingDate).toBeTruthy();
    }
  });

  // ── 3. resubscribe after end_date creates new subscription ──────────────
  it('resubscribe after end_date creates new subscription', async () => {
    d1Config.subscription = makeCancelledSub(60); // cancelled 60 days ago (beyond 30-day grace)

    const { resubscribe } = await import('@/land/billing/actions/resubscribe-action');
    const result = await resubscribe();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GRACE_PERIOD_EXPIRED');
    }
  });

  // ── 4. cancel when not subscribed returns error ─────────────────────────
  it('cancel when not subscribed returns error', async () => {
    d1Config.subscription = null;

    const { cancelSubscription } = await import('@/land/billing/actions/cancel-subscription-action');
    const result = await cancelSubscription();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeDefined();
    }
  });
});
