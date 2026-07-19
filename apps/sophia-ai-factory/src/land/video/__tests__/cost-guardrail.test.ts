/**
 * Tests for video cost guardrail. Verifies path-tier pricing, balance
 * gate (MCU + pack credits unified), and defensive deny on lookup failure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/tree/mcu/credits-repo', () => ({
  getTotalCredits: vi.fn(),
}));

import { checkVideoBudget } from '../templates/cost-guardrail';
import { getTotalCredits } from '@/tree/mcu/credits-repo';

const mockTotalCredits = vi.mocked(getTotalCredits);

describe('checkVideoBudget', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows when credits >= estimated for path-a', async () => {
    mockTotalCredits.mockResolvedValue({ mcu: 5, pack: 0, total: 5 });
    const result = await checkVideoBudget('user-1', 'path-a');
    expect(result.allowed).toBe(true);
    expect(result.estimatedCredits).toBe(2); // ceil(0.18 / 0.10)
  });

  it('denies when credits < estimated for path-b cinematic', async () => {
    mockTotalCredits.mockResolvedValue({ mcu: 3, pack: 0, total: 3 });
    const result = await checkVideoBudget('user-1', 'path-b');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('insufficient_credits');
    expect(result.estimatedCredits).toBe(6); // ceil(0.55 / 0.10)
    expect(result.hint).toContain('Need 6');
  });

  it('treats balance lookup failure as deny (defensive)', async () => {
    mockTotalCredits.mockRejectedValue(new Error('D1 down'));
    const result = await checkVideoBudget('user-1', 'path-a');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('insufficient_credits');
    expect(result.creditsRemaining).toBe(0);
  });

  it('template path is the cheapest tier', async () => {
    mockTotalCredits.mockResolvedValue({ mcu: 1, pack: 0, total: 1 });
    const result = await checkVideoBudget('user-1', 'template');
    expect(result.allowed).toBe(true);
    expect(result.estimatedCredits).toBe(1); // ceil(0.06 / 0.10)
  });

  it('exposes creditsRemaining for UI countdown', async () => {
    mockTotalCredits.mockResolvedValue({ mcu: 25, pack: 17, total: 42 });
    const result = await checkVideoBudget('user-1', 'path-a');
    expect(result.creditsRemaining).toBe(42);
  });

  it('allows video generation when 0 MCU but 20 pack credits cover template cost', async () => {
    // Revenue leak fix: users with only pack credits should not be blocked
    mockTotalCredits.mockResolvedValue({ mcu: 0, pack: 20, total: 20 });
    const result = await checkVideoBudget('user-1', 'template');
    expect(result.allowed).toBe(true);
    expect(result.creditsRemaining).toBe(20);
  });

  it('denies path-b when 5 MCU + 0 pack is below required 6 credits', async () => {
    mockTotalCredits.mockResolvedValue({ mcu: 5, pack: 0, total: 5 });
    const result = await checkVideoBudget('user-1', 'path-b');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('insufficient_credits');
    expect(result.creditsRemaining).toBe(5);
    expect(result.hint).toContain('Need 6');
  });
});
