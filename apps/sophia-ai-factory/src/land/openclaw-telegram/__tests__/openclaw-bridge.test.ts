/**
 * Unit tests for the OpenClaw bridge — covers resolver fallback,
 * version probe, and dispatcher branches that do not require live D1.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const { mockSingle, mockFrom } = vi.hoisted(() => {
  const single = vi.fn();
  const limit = vi.fn(() => ({ single }));
  const order = vi.fn(() => ({ limit }));
  const eq2 = vi.fn(() => ({ order, limit, single }));
  const eq1 = vi.fn(() => ({ eq: eq2, order, limit, single }));
  const select = vi.fn(() => ({ eq: eq1, order, limit, single }));
  const from = vi.fn(() => ({ select }));
  return { mockSingle: single, mockFrom: from };
});

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ from: mockFrom }),
  getD1: vi.fn(),
}));

vi.mock('@/forest/quota/quota-checker-overage', () => ({
  getQuotaStatus: vi.fn(),
}));

vi.mock('@/land/affiliates/dashboard-stats', () => ({
  getRecentConversions: vi.fn(),
}));

vi.mock('@/land/promo/promo-applier', () => ({
  applyPromoCode: vi.fn(),
}));

vi.mock('@/land/promo/promo-validator', () => ({
  validatePromoCode: vi.fn(),
}));

vi.mock('@/tree/handover/handover-account-setup', () => ({
  createCustomerUser: vi.fn(),
}));

import {
  resolveUserIdFromChat,
  callGetVersion,
  callGetTier,
  callGetAffiliateStats,
  callRedeemFree100,
} from '../openclaw-bridge';
import { getRecentConversions } from '@/land/affiliates/dashboard-stats';
import { validatePromoCode } from '@/land/promo/promo-validator';
import { applyPromoCode } from '@/land/promo/promo-applier';

const ORIGINAL_ENV = { ...process.env };
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('openclaw-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null });
  });

  // ─── resolveUserIdFromChat ──────────────────────────────────────────────

  it('returns null when chat is not paired', async () => {
    mockSingle.mockResolvedValue({ data: null });
    const userId = await resolveUserIdFromChat('non-paired-chat');
    expect(userId).toBeNull();
  });

  it('returns paired_by when chat is paired', async () => {
    mockSingle.mockResolvedValue({ data: { paired_by: 'user-42' } });
    const userId = await resolveUserIdFromChat('chat-42');
    expect(userId).toBe('user-42');
  });

  // ─── callGetVersion ─────────────────────────────────────────────────────

  it('returns short SHA from COMMIT_SHA env', () => {
    process.env.COMMIT_SHA = 'b6e5dfaf1234abcd';
    process.env.DEPLOYED_AT = '2026-05-20T02:09:21Z';
    const v = callGetVersion();
    expect(v.shortSha).toBe('b6e5dfaf');
    expect(v.deployedAt).toBe('2026-05-20T02:09:21Z');
  });

  it('returns unknown when COMMIT_SHA is absent', () => {
    delete process.env.COMMIT_SHA;
    delete process.env.DEPLOYED_AT;
    const v = callGetVersion();
    expect(v.shortSha).toBe('unknown');
    expect(v.deployedAt).toBe('unknown');
  });

  // ─── callGetTier ────────────────────────────────────────────────────────

  it('returns null when user row missing', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: null }) // user_profiles
      .mockResolvedValueOnce({ data: null }); // user
    const info = await callGetTier('user-missing');
    expect(info).toBeNull();
  });

  it('uppercases tier from license', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { settings: JSON.stringify({ display_name: 'Tho', locale: 'vi' }) } })
      .mockResolvedValueOnce({ data: { email: 'tho@example.com', name: 'Tho' } })
      .mockResolvedValueOnce({ data: { tier: 'master' } });
    const info = await callGetTier('user-7');
    expect(info?.tier).toBe('MASTER');
    expect(info?.locale).toBe('vi');
    expect(info?.displayName).toBe('Tho');
  });

  // ─── callGetAffiliateStats ──────────────────────────────────────────────

  it('returns empty when getRecentConversions throws', async () => {
    vi.mocked(getRecentConversions).mockRejectedValue(new Error('db down'));
    const stats = await callGetAffiliateStats('user-1');
    expect(stats.count).toBe(0);
    expect(stats.conversions).toEqual([]);
  });

  it('returns count + conversions on success', async () => {
    vi.mocked(getRecentConversions).mockResolvedValue([
      { conversionId: 'c1', linkId: 'l1', offerId: 'o1', networkTransactionId: 't1', grossAmountUsd: 50, commissionUsd: 10, status: 'approved', attributedAt: 1700000000 },
    ]);
    const stats = await callGetAffiliateStats('user-1');
    expect(stats.count).toBe(1);
    expect(stats.conversions[0].commissionUsd).toBe(10);
  });

  // ─── callRedeemFree100 ──────────────────────────────────────────────────

  it('rejects invalid promo code', async () => {
    vi.mocked(validatePromoCode).mockResolvedValue({ valid: false, reason: 'expired' } as Awaited<ReturnType<typeof validatePromoCode>>);
    const result = await callRedeemFree100({ code: 'BAD', email: 'a@b.c' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('expired');
  });

  it('rejects paid promo (must use checkout)', async () => {
    vi.mocked(validatePromoCode).mockResolvedValue({ valid: true, discountType: 'percentage', appliesToTier: 'MASTER' } as unknown as Awaited<ReturnType<typeof validatePromoCode>>);
    const result = await callRedeemFree100({ code: 'PAID', email: 'a@b.c' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('payment');
  });

  it('propagates magicLink on free-promo success path', async () => {
    vi.mocked(validatePromoCode).mockResolvedValue({ valid: true, discountType: 'free_full', appliesToTier: 'MASTER' } as Awaited<ReturnType<typeof validatePromoCode>>);
    // applyPromoCode is the leaf; createCustomerUser is mocked indirectly via getD1 mock setup
    vi.mocked(applyPromoCode).mockResolvedValue({
      redemptionId: 'r1',
      magicLink: 'https://sophia.agencyos.network/auth/magic/abc',
      handoverId: 'h1',
      trialDaysGranted: 7,
    } as Awaited<ReturnType<typeof applyPromoCode>>);
    // Avoid the D1 lookup path — emulate user already exists by stubbing getD1.
    const { getD1 } = await import('@/seed/db/client');
    vi.mocked(getD1).mockReturnValue({
      prepare: () => ({
        bind: () => ({ first: async () => ({ id: 'user-x' }) }),
      }),
    } as any);
    const result = await callRedeemFree100({ code: 'FREE100', email: 'new@test.com' });
    expect(result.success).toBe(true);
    expect(result.magicLink).toBe('https://sophia.agencyos.network/auth/magic/abc');
    expect(result.handoverId).toBe('h1');
  });
});
