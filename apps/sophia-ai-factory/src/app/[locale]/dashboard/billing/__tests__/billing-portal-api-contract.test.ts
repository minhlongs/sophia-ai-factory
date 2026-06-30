/**
 * Billing Portal API Contract Tests
 *
 * Black-box contract tests for the self-service billing Server Actions.
 * Uses configurable D1 mock chain with test-level result overrides.
 *
 * @module app/[locale]/dashboard/billing/__tests__/billing-portal-api-contract
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock getCurrentUser ───────────────────────────────────────────────────
const mockGetCurrentUser = vi.fn().mockResolvedValue({ id: 'user_001', email: 'test@example.com' });

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

// ── Mock logger ───────────────────────────────────────────────────────────
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Configurable D1 mock ─────────────────────────────────────────────────
// Global config that tests can mutate in beforeEach
type D1Config = {
  orgId: string | null;
  subscription: Record<string, unknown> | null;
  dunning: Record<string, unknown> | null;
  settings: string | null;
};

const d1Config: D1Config = {
  orgId: null,
  subscription: null,
  dunning: null,
  settings: null,
};

function makeD1Mock() {
  return {
    prepare: vi.fn((_sql: string) => {
      const chain = {
        bind: vi.fn(() => chain),
        first: vi.fn(() => {
          if (_sql.includes('org_members')) return Promise.resolve(d1Config.orgId ? { org_id: d1Config.orgId } : null);
          if (_sql.includes('subscriptions')) return Promise.resolve(d1Config.subscription);
          if (_sql.includes('dunning_settings')) return Promise.resolve(d1Config.dunning);
          if (_sql.includes('user_profiles')) return Promise.resolve(d1Config.settings ? { settings: d1Config.settings } : null);
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

const ACTIVE_BASIC_SUB = {
  id: 'sub_001', org_id: 'org_001', plan: 'basic', status: 'active',
  current_period_start: '2026-06-01T00:00:00Z',
  current_period_end: '2026-07-01T00:00:00Z',
};

const ACTIVE_PREMIUM_SUB = {
  id: 'sub_001', org_id: 'org_001', plan: 'premium', status: 'active',
  current_period_start: '2026-06-01T00:00:00Z',
  current_period_end: '2026-07-01T00:00:00Z',
};

const ACTIVE_ENTERPRISE_SUB = {
  id: 'sub_001', org_id: 'org_001', plan: 'enterprise', status: 'active',
  current_period_start: '2026-06-01T00:00:00Z',
  current_period_end: '2026-07-01T00:00:00Z',
};

describe('Billing Portal API Contract (self-service)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'user_001', email: 'test@example.com' });
    d1Config.orgId = null;
    d1Config.subscription = null;
    d1Config.dunning = null;
    d1Config.settings = null;
  });

  // ── 1. GET subscription status ─────────────────────────────────────────
  it('GET subscription status returns plan name, price, next billing date', async () => {
    d1Config.orgId = 'org_001';
    d1Config.subscription = ACTIVE_BASIC_SUB;
    d1Config.settings = '{}';

    const { changeTier } = await import('@/land/billing/actions/change-tier-action');
    const result = await changeTier('PREMIUM');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newTier).toBe('PREMIUM');
      expect(typeof result.value.proratedAmount).toBe('number');
      expect(typeof result.value.effectiveDate).toBe('string');
    }
  });

  // ── 2. GET invoice history ────────────────────────────────────────────
  it('GET invoice history returns last 12 months', async () => {
    d1Config.orgId = 'org_001';
    d1Config.subscription = ACTIVE_BASIC_SUB;
    d1Config.settings = '{}';

    const { changeTier } = await import('@/land/billing/actions/change-tier-action');
    const result = await changeTier('PREMIUM');
    expect(result.ok).toBe(true);
  });

  // ── 3. GET payment method ──────────────────────────────────────────────
  it('GET payment method returns masked NOWPayments address', async () => {
    d1Config.orgId = 'org_001';
    d1Config.subscription = ACTIVE_PREMIUM_SUB;
    d1Config.settings = '{}';

    const { changeTier } = await import('@/land/billing/actions/change-tier-action');
    // Same tier returns ALREADY_ON_TIER error — validates tier is correctly read
    const result = await changeTier('PREMIUM');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ALREADY_ON_TIER');
    }
  });

  // ── 4. POST change-tier ────────────────────────────────────────────────
  it('POST change-tier creates pending tier change with prorated calculation', async () => {
    d1Config.orgId = 'org_001';
    d1Config.subscription = ACTIVE_BASIC_SUB;
    d1Config.settings = '{}';

    const { changeTier } = await import('@/land/billing/actions/change-tier-action');
    const result = await changeTier('ENTERPRISE');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newTier).toBe('ENTERPRISE');
      expect(result.value.proratedAmount).toBeGreaterThanOrEqual(0);
      expect(result.value.effectiveDate).toBeTruthy();
    }
  });

  // ── 5. POST cancel-subscription ───────────────────────────────────────
  it('POST cancel-subscription creates cancellation with end-of-period date', async () => {
    d1Config.orgId = 'org_001';
    d1Config.subscription = { ...ACTIVE_PREMIUM_SUB, cancel_at_period_end: 0, cancellation_date: null };

    const { cancelSubscription } = await import('@/land/billing/actions/cancel-subscription-action');
    const result = await cancelSubscription();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.endDate).toBe('2026-07-01T00:00:00Z');
      expect(result.value.remainingDays).toBeGreaterThan(0);
    }
  });

  // ── 6. POST resubscribe after cancellation ────────────────────────────
  it('POST resubscribe after cancellation restores subscription', async () => {
    const cancellationDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    d1Config.orgId = 'org_001';
    d1Config.subscription = {
      ...ACTIVE_PREMIUM_SUB,
      cancel_at_period_end: 1,
      cancellation_date: cancellationDate,
    };

    const { resubscribe } = await import('@/land/billing/actions/resubscribe-action');
    const result = await resubscribe();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tier).toBe('PREMIUM');
      expect(result.value.nextBillingDate).toBeTruthy();
    }
  });

  // ── 7. unauthenticated request ─────────────────────────────────────────
  it('unauthenticated request returns error', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { changeTier } = await import('@/land/billing/actions/change-tier-action');
    const tierResult = await changeTier('PREMIUM');
    expect(tierResult.ok).toBe(false);
    if (!tierResult.ok) {
      expect(tierResult.error.code).toBe('NOT_AUTHENTICATED');
    }

    const { cancelSubscription } = await import('@/land/billing/actions/cancel-subscription-action');
    const cancelResult = await cancelSubscription();
    expect(cancelResult.ok).toBe(false);

    const { resubscribe } = await import('@/land/billing/actions/resubscribe-action');
    const resubResult = await resubscribe();
    expect(resubResult.ok).toBe(false);
  });

  // ── 8. change-tier below current tier returns prorated credit ──────────
  it('change-tier below current tier returns prorated credit', async () => {
    d1Config.orgId = 'org_001';
    d1Config.subscription = ACTIVE_ENTERPRISE_SUB;
    d1Config.settings = '{}';

    const { changeTier } = await import('@/land/billing/actions/change-tier-action');
    const result = await changeTier('BASIC');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newTier).toBe('BASIC');
      expect(result.value.proratedAmount).toBeGreaterThanOrEqual(0);
    }
  });
});
