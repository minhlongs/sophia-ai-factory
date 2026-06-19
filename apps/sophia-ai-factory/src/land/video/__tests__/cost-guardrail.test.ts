/**
 * Tests for video cost guardrail. Verifies path-tier pricing, balance
 * gate, and defensive deny on lookup failure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/land/mcu/credits-repo', () => ({
  getBalance: vi.fn(),
}));

import { checkVideoBudget } from '../templates/cost-guardrail';
import { getBalance } from '@/tree/mcu/credits-repo';

const mockBalance = vi.mocked(getBalance);

describe('checkVideoBudget', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows when credits >= estimated for path-a', async () => {
    mockBalance.mockResolvedValue({
      credits_remaining: 5,
      credits_total_purchased: 100,
      credits_total_used: 95,
    });
    const result = await checkVideoBudget('user-1', 'path-a');
    expect(result.allowed).toBe(true);
    expect(result.estimatedCredits).toBe(2); // ceil(0.18 / 0.10)
  });

  it('denies when credits < estimated for path-b cinematic', async () => {
    mockBalance.mockResolvedValue({
      credits_remaining: 3,
      credits_total_purchased: 0,
      credits_total_used: 0,
    });
    const result = await checkVideoBudget('user-1', 'path-b');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('insufficient_credits');
    expect(result.estimatedCredits).toBe(6); // ceil(0.55 / 0.10)
    expect(result.hint).toContain('Need 6');
  });

  it('treats balance lookup failure as deny (defensive)', async () => {
    mockBalance.mockRejectedValue(new Error('D1 down'));
    const result = await checkVideoBudget('user-1', 'path-a');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('insufficient_credits');
    expect(result.creditsRemaining).toBe(0);
  });

  it('template path is the cheapest tier', async () => {
    mockBalance.mockResolvedValue({
      credits_remaining: 1,
      credits_total_purchased: 0,
      credits_total_used: 0,
    });
    const result = await checkVideoBudget('user-1', 'template');
    expect(result.allowed).toBe(true);
    expect(result.estimatedCredits).toBe(1); // ceil(0.06 / 0.10)
  });

  it('exposes credits_remaining for UI countdown', async () => {
    mockBalance.mockResolvedValue({
      credits_remaining: 42,
      credits_total_purchased: 100,
      credits_total_used: 58,
    });
    const result = await checkVideoBudget('user-1', 'path-a');
    expect(result.creditsRemaining).toBe(42);
  });
});
