/**
 * Tests for enforce-ai-command-quota.ts — P30 tier-gate completeness.
 *
 * Boundary tests across BASIC (5/mo) / PREMIUM (15/mo) / ENTERPRISE (15/mo) /
 * MASTER (999 = unlimited).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn(),
}));

const fromSelectEqGte = vi.fn();
vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: fromSelectEqGte,
        }),
      }),
    }),
  }),
}));

import { getUserTier } from '@/seed/db/get-user-tier';
import { checkAiCommandQuota } from '@/seed/auth/enforce-ai-command-quota';

const mockGetUserTier = getUserTier as ReturnType<typeof vi.fn>;

describe('checkAiCommandQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('MASTER tier short-circuits as unlimited (no DB query)', async () => {
    mockGetUserTier.mockResolvedValue('MASTER');
    const result = await checkAiCommandQuota('user-master');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(999);
    expect(fromSelectEqGte).not.toHaveBeenCalled();
  });

  it('BASIC tier allows when used (4) < limit (5)', async () => {
    mockGetUserTier.mockResolvedValue('BASIC');
    fromSelectEqGte.mockResolvedValueOnce({ data: Array.from({ length: 4 }, (_, i) => ({ id: `m${i}` })) });
    const result = await checkAiCommandQuota('user-basic');
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('BASIC tier denies at boundary (used=5 >= limit=5)', async () => {
    mockGetUserTier.mockResolvedValue('BASIC');
    fromSelectEqGte.mockResolvedValueOnce({ data: Array.from({ length: 5 }, (_, i) => ({ id: `m${i}` })) });
    const result = await checkAiCommandQuota('user-basic-full');
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(5);
    expect(result.limit).toBe(5);
    expect(result.reason).toContain('5');
    expect(result.reason).toContain('BASIC');
  });

  it('PREMIUM tier allows higher quota (used=10, limit=15)', async () => {
    mockGetUserTier.mockResolvedValue('PREMIUM');
    fromSelectEqGte.mockResolvedValueOnce({ data: Array.from({ length: 10 }, (_, i) => ({ id: `m${i}` })) });
    const result = await checkAiCommandQuota('user-premium');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(15);
  });

  it('PREMIUM tier denies past 15', async () => {
    mockGetUserTier.mockResolvedValue('PREMIUM');
    fromSelectEqGte.mockResolvedValueOnce({ data: Array.from({ length: 15 }, (_, i) => ({ id: `m${i}` })) });
    const result = await checkAiCommandQuota('user-premium-full');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('PREMIUM');
  });

  it('ENTERPRISE tier shares 15 limit with PREMIUM (per UNIFIED_TIERS)', async () => {
    mockGetUserTier.mockResolvedValue('ENTERPRISE');
    fromSelectEqGte.mockResolvedValueOnce({ data: Array.from({ length: 14 }, (_, i) => ({ id: `m${i}` })) });
    const result = await checkAiCommandQuota('user-enterprise');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(15);
  });

  it('null DB result is treated as zero usage', async () => {
    mockGetUserTier.mockResolvedValue('BASIC');
    fromSelectEqGte.mockResolvedValueOnce({ data: null });
    const result = await checkAiCommandQuota('user-empty');
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
  });

  it('resetsAt is start of next month UTC (ISO)', async () => {
    mockGetUserTier.mockResolvedValue('MASTER');
    const result = await checkAiCommandQuota('user-reset-check');
    expect(result.resetsAt).toMatch(/^\d{4}-\d{2}-01T00:00:00\.000Z$/);
  });
});
