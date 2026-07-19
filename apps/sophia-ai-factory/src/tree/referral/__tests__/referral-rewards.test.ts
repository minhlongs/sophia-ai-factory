import { describe, it, expect } from 'vitest';
import { calculateReward } from '../referral-rewards';

describe('tree/referral/referral-rewards', () => {
  it('computes BASIC 10% reward (e.g. 1000¢ → 100¢)', () => {
    const out = calculateReward({ tier: 'BASIC', paymentAmountCents: 1000 });
    expect(out.rewardCents).toBe(100);
    expect(out.tier).toBe('BASIC');
  });

  it('PREMIUM 12%', () => {
    expect(calculateReward({ tier: 'PREMIUM', paymentAmountCents: 1000 }).rewardCents).toBe(120);
  });

  it('ENTERPRISE 15%', () => {
    expect(calculateReward({ tier: 'ENTERPRISE', paymentAmountCents: 1000 }).rewardCents).toBe(150);
  });

  it('MASTER 18%', () => {
    expect(calculateReward({ tier: 'MASTER', paymentAmountCents: 1000 }).rewardCents).toBe(180);
  });

  it('rounds down odd cent', () => {
    expect(calculateReward({ tier: 'PREMIUM', paymentAmountCents: 1050 }).rewardCents).toBe(126); // floor(1050*0.12=126)
  });

  it('zero amount = 0 reward', () => {
    expect(calculateReward({ tier: 'BASIC', paymentAmountCents: 0 }).rewardCents).toBe(0);
  });

  it('throws on negative amount', () => {
    expect(() => calculateReward({ tier: 'BASIC', paymentAmountCents: -1 })).toThrow();
  });

  it('throws on unknown tier', () => {
    // @ts-expect-error valid runtime guard coverage
    expect(() => calculateReward({ tier: 'UNKNOWN', paymentAmountCents: 1000 })).toThrow();
  });
});
