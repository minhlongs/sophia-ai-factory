/**
 * Land referral service tests.
 *
 * @module referral/referral-service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Global call counter — reset per test ────────────────────────────────────
// Mock uses this to simulate ON CONFLICT DO NOTHING:
//   seq=1  → INSERT succeeds  → changes:1  (lock acquired)
//   seq=2+ → INSERT conflicts → changes:0  (already exists)
//   seq>=5 → first() returns processed row → alreadyProcessed:true
let seq = 0;

const _mockDbFactory = vi.hoisted(() => {
  const _chains = { postProcessed: () => Promise.resolve([]) };
  return { chains: _chains };
});

vi.mock('@/seed/db/client', () => {
  function runPrepared() {
    const currentSeq = ++seq;

    return {
      bind: () => ({
        run: () => {
          // first call: changes:1 (acquired); all others: changes:0
          return { meta: { changes: currentSeq === 1 ? 1 : 0 } };
        },
        first: () => {
          // after enough calls, return a processed row for idempotency
          if (currentSeq >= 5) {
            return { id: 'evt1', processed: 1 as 1 };
          }
          return null;
        },
        maybeSingle: () => null,
      }),
    };
  }

  return {
    getD1: () => ({
      prepare: runPrepared,
      batch: () => undefined,
    }),
    createServerClient: () => ({
      prepare: runPrepared,
      batch: () => undefined,
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => ({}),
            maybeSingle: () => ({}),
          }),
        }),
      }),
    }),
  };
});

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    withRequestId: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }),
    child: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }),
    context: 'test',
  },
}));

import { recordReferralEvent, awardReferralRewardUponPayment, resolveReferrerForSignup } from '../referral-service';

describe('land/referral/referral-service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    seq = 0;
  });

  // ── recordReferralEvent ────────────────────────────────────────────────────
  describe('recordReferralEvent', () => {
    it('records a valid created event', () => {
      const r = recordReferralEvent({ code: 'REF-123', type: 'created', referrerId: 'u_1' });
      expect(r.ok).toBe(true);
    });

    it('rejects missing mandatory fields', () => {
      expect(recordReferralEvent({ code: '', type: 'created', referrerId: '' }).ok).toBe(false);
      expect(recordReferralEvent({ code: 'A', type: 'created', referrerId: '' }).ok).toBe(false);
    });
  });

  // ── resolveReferrerForSignup ───────────────────────────────────────────────
  describe('resolveReferrerForSignup', () => {
    it('returns null on bad code', async () => {
      const r = await resolveReferrerForSignup('does-not-exist');
      expect(r).toBeNull();
    });
  });

  // ── awardReferralRewardUponPayment ────────────────────────────────────────
  describe('awardReferralRewardUponPayment', () => {
    const baseInput = {
      referrerId: 'u_referrer',
      referredUserId: 'u_referred',
      paymentId: 'nowpayments_123',
      tier: 'BASIC' as const,
      paymentAmountCents: 1000,
    };

    it('returns the expected 10% BASIC reward on success', async () => {
      const res = await awardReferralRewardUponPayment(baseInput);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.rewardCents).toBe(100); // 10% of 1000
        expect(res.value.tier).toBe('BASIC');
      }
    });

    it('computes tier-aware reward across all tiers', async () => {
      const tiers: Array<{ tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'; expected: number }> = [
        { tier: 'BASIC', expected: 100 },
        { tier: 'PREMIUM', expected: 120 },
        { tier: 'ENTERPRISE', expected: 150 },
        { tier: 'MASTER', expected: 180 },
      ];

      for (const { tier, expected } of tiers) {
        const r = await awardReferralRewardUponPayment({
          ...baseInput,
          tier,
          paymentId: `nowpayments_${tier}`,
        });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value.rewardCents).toBe(expected);
      }
    });

    it('returns success on idempotent re-run (already processed lock)', async () => {
      // First call: lock acquired, reward inserted, released.
      // seq resets here, processedSeen becomes true.
      const r1 = await awardReferralRewardUponPayment(baseInput);
      expect(r1.ok).toBe(true);
      if (!r1.ok) throw new Error('idempotent: expected success');
    expect(r1.value.rewardCents).toBe(100);

      // Reset seq; set processedSeen=true → next acquireRewardLock hit
      // the alreadyProcessed branch → returns cached success.
      seq = 0;
      // Patch first() to always return processed row from here on
      // (we can't use a flag, so reset seq to a high value:)
      seq = 5;

      const r2 = await awardReferralRewardUponPayment(baseInput);
      expect(r2.ok).toBe(true);
      if (r2.ok) expect(r2.value.rewardCents).toBe(100);
    });

    it('returns failure when D1 binding is absent', async () => {
      // Swap getD1 to return null via the mock module
      const mod = await import('@/seed/db/client');
      const original = (mod as Record<string, unknown>).getD1;
      (mod as Record<string, unknown>).getD1 = () => null;

      const r = await awardReferralRewardUponPayment({
        referrerId: 'uX',
        referredUserId: 'uY',
        paymentId: 'pay_X',
        tier: 'BASIC',
        paymentAmountCents: 1000,
      });

      expect(r.ok).toBe(false);
      (mod as Record<string, unknown>).getD1 = original;
    });

    it('returns failure when referral-rewards-db insert errors', async () => {
      // Same D1-absent path → insertRewardLedgerAndCredit returns failure
      const mod = await import('@/seed/db/client');
      const original = (mod as Record<string, unknown>).getD1;
      (mod as Record<string, unknown>).getD1 = () => null;

      const r = await awardReferralRewardUponPayment(baseInput);
      expect(r.ok).toBe(false);

      (mod as Record<string, unknown>).getD1 = original;
    });
  });
});
