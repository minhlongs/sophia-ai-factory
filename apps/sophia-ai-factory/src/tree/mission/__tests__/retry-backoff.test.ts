/**
 * Tests for tree/mission/retry-backoff — pure backoff math.
 *
 * Fully deterministic: no Date.now(), no mocks, fixed epoch constants only.
 * Covers the delay ladder (retryCount 0/1/2/3+), the 30-min cap, clamp and
 * floor of invalid retryCount, isRetryDue boundary semantics, and
 * isRetriesExhausted at and around the cap (including maxAutoRetries = 0).
 */

import { describe, it, expect } from 'vitest';
import {
  BASE_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  nextRetryAtMs,
  isRetryDue,
  isRetriesExhausted,
} from '../retry-backoff';

/** Arbitrary but fixed epoch-ms instant — never derived from the real clock. */
const T0 = 1_750_000_000_000;

const MIN = 60 * 1000;

describe('nextRetryAtMs', () => {
  it.each([
    [0,5 * MIN],
    [1, 10 * MIN],
    [2, 20 * MIN],
  ])('retryCount %i → uncapped exponential delay %i ms', (retryCount, expectedDelay) => {
    expect(nextRetryAtMs(T0, retryCount)).toBe(T0 + expectedDelay);
  });

  it('retryCount 3 → capped at 30 min (uncapped would be 40 min)', () => {
    expect(5 * Math.pow(2, 3) * MIN).toBeGreaterThan(MAX_RETRY_DELAY_MS);
    expect(nextRetryAtMs(T0, 3)).toBe(T0 + MAX_RETRY_DELAY_MS);
  });

  it('retryCount 4 and 10 → still capped at exactly 30 min', () => {
    expect(nextRetryAtMs(T0, 4)).toBe(T0 + 30 * MIN);
    expect(nextRetryAtMs(T0, 10)).toBe(T0 + MAX_RETRY_DELAY_MS);
  });

  it('negative retryCount clamps to 0 → first-retry delay', () => {
    expect(nextRetryAtMs(T0, -1)).toBe(T0 + BASE_RETRY_DELAY_MS);
    expect(nextRetryAtMs(T0, -100)).toBe(T0 + BASE_RETRY_DELAY_MS);
  });

  it('fractional retryCount floors before exponentiating', () => {
    // floor(1.9) = 1 → 10 min, not 5 · 2^1.9
    expect(nextRetryAtMs(T0, 1.9)).toBe(T0 + 10 * MIN);
    expect(nextRetryAtMs(T0, 0.5)).toBe(T0 + BASE_RETRY_DELAY_MS);
  });

  it('is a pure function: same inputs → same output', () => {
    expect(nextRetryAtMs(T0, 2)).toBe(nextRetryAtMs(T0, 2));
  });
});

describe('isRetryDue', () => {
  const endedAt = T0;
  const retryCount = 1; // 10-minute backoff

  it('false strictly before the backoff window elapses', () => {
    expect(isRetryDue({ endedAt, retryCount, nowMs: T0 + 10 * MIN - 1 })).toBe(false);
  });

  it('true at the exact boundary (>= semantics)', () => {
    expect(isRetryDue({ endedAt, retryCount, nowMs: T0 + 10 * MIN })).toBe(true);
  });

  it('true after the boundary', () => {
    expect(isRetryDue({ endedAt, retryCount, nowMs: T0 + 10 * MIN + 1 })).toBe(true);
  });

  it('long-past failure (>30 min old) always due regardless of retryCount', () => {
    // Old failures beyond any fixed scan window must never be dropped again.
    const threeHoursAgo = T0 - 3 * 60 * MIN;
    const counts = [0, 1, 2, 3, 7];
    for (const rc of counts) {
      expect(isRetryDue({ endedAt: threeHoursAgo, retryCount: rc, nowMs: T0 })).toBe(true);
    }
  });

  it('capped backoff (retryCount 3) due only after the full 30-min cap', () => {
    expect(isRetryDue({ endedAt: T0, retryCount: 3, nowMs: T0 + 29 * MIN })).toBe(false);
    expect(isRetryDue({ endedAt: T0, retryCount: 3, nowMs: T0 + 30 * MIN })).toBe(true);
  });

  it('negative retryCount behaves like retryCount 0', () => {
    expect(isRetryDue({ endedAt: T0, retryCount: -1, nowMs: T0 + 5 * MIN - 1 })).toBe(false);
    expect(isRetryDue({ endedAt: T0, retryCount: -1, nowMs: T0 + 5 * MIN })).toBe(true);
  });
});

describe('isRetriesExhausted', () => {
  it('false while retryCount < maxAutoRetries', () => {
    expect(isRetriesExhausted(0, 3)).toBe(false);
    expect(isRetriesExhausted(2, 3)).toBe(false);
  });

  it('true at the exact cap (retryCount === maxAutoRetries)', () => {
    expect(isRetriesExhausted(3, 3)).toBe(true);
  });

  it('true beyond the cap', () => {
    expect(isRetriesExhausted(4, 3)).toBe(true);
  });

  it('maxAutoRetries 0 → immediately exhausted (never auto-retry)', () => {
    expect(isRetriesExhausted(0, 0)).toBe(true);
    expect(isRetriesExhausted(5, 0)).toBe(true);
  });

  it('per-policy cap respected (maxAutoRetries 1)', () => {
    expect(isRetriesExhausted(0, 1)).toBe(false);
    expect(isRetriesExhausted(1, 1)).toBe(true);
  });
});
