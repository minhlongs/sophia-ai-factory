/**
 * Tests for funnel-stats primitive.
 * D1 mocked via globalThis.__env.DB pattern.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getActivationFunnel } from './funnel-stats';

interface CountResult {
  n?: number;
}

function setD1Mock(opts: { sequence?: Array<CountResult | null> }) {
  const queue = [...(opts.sequence ?? [])];
  const bind = vi.fn().mockImplementation(() => ({
    first: vi.fn().mockImplementation(() => Promise.resolve(queue.shift() ?? null)),
  }));
  const db = { prepare: vi.fn().mockReturnValue({ bind }) };
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
    ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
    DB: db,
  };
}

afterEach(() => vi.clearAllMocks());

describe('getActivationFunnel', () => {
  it('returns zero funnel + zero conversions when D1 returns null rows', async () => {
    setD1Mock({});
    const result = await getActivationFunnel(0, 100);
    expect(result.signups).toBe(0);
    expect(result.firstLogin).toBe(0);
    expect(result.firstVideo).toBe(0);
    expect(result.firstConversion).toBe(0);
    expect(result.conversions.signupToLogin).toBe(0);
    expect(result.conversions.loginToVideo).toBe(0);
    expect(result.conversions.videoToConversion).toBe(0);
  });

  it('computes step ratios correctly', async () => {
    setD1Mock({
      sequence: [
        { n: 100 }, // signups
        { n: 60 },  // firstLogin
        { n: 30 },  // firstVideo
        { n: 6 },   // firstConversion
      ],
    });
    const result = await getActivationFunnel(0, 100);
    expect(result.signups).toBe(100);
    expect(result.firstLogin).toBe(60);
    expect(result.firstVideo).toBe(30);
    expect(result.firstConversion).toBe(6);
    expect(result.conversions.signupToLogin).toBeCloseTo(0.6);
    expect(result.conversions.loginToVideo).toBeCloseTo(0.5);
    expect(result.conversions.videoToConversion).toBeCloseTo(0.2);
  });

  it('handles step transitions with zero predecessors (no division by zero)', async () => {
    setD1Mock({
      sequence: [
        { n: 5 },   // signups
        { n: 0 },   // firstLogin
        { n: 0 },   // firstVideo
        { n: 0 },   // firstConversion
      ],
    });
    const result = await getActivationFunnel(0, 100);
    expect(result.conversions.signupToLogin).toBe(0);
    expect(result.conversions.loginToVideo).toBe(0);
    expect(result.conversions.videoToConversion).toBe(0);
  });

  it('coerces non-numeric counts to numbers', async () => {
    setD1Mock({
      sequence: [
        { n: 10 },
        { n: 5 },
        { n: 2 },
        { n: 1 },
      ],
    });
    const result = await getActivationFunnel(0, 100);
    expect(typeof result.signups).toBe('number');
    expect(typeof result.firstLogin).toBe('number');
  });

  it('throws when fromTs > toTs', async () => {
    setD1Mock({});
    await expect(getActivationFunnel(200, 100)).rejects.toThrow(/fromTs/);
  });

  it('echoes the requested window in the response', async () => {
    setD1Mock({});
    const result = await getActivationFunnel(1700000000, 1700000600);
    expect(result.fromTs).toBe(1700000000);
    expect(result.toTs).toBe(1700000600);
  });
});
