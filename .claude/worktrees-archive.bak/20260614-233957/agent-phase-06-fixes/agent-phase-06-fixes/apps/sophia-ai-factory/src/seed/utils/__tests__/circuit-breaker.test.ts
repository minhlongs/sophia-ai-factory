/**
 * Tests for the lightweight circuit breaker (seed/utils canonical location).
 * Verifies state machine: CLOSED → OPEN (after N failures) → HALF_OPEN
 * (after resetTimeout) → CLOSED (on probe success) | OPEN (on probe failure).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  withBreaker,
  getBreakerState,
  resetBreaker,
  BreakerOpenError,
} from '../circuit-breaker';

const NAME = 'test-breaker';
const CFG = { failureThreshold: 3, resetTimeoutMs: 10_000 };

describe('circuit-breaker', () => {
  beforeEach(() => {
    resetBreaker(NAME);
    vi.useRealTimers();
  });

  it('starts CLOSED and runs fn normally', async () => {
    const result = await withBreaker(NAME, async () => 'ok', CFG);
    expect(result).toBe('ok');
    expect(getBreakerState(NAME)).toBe('closed');
  });

  it('opens after `failureThreshold` consecutive failures', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(withBreaker(NAME, async () => { throw new Error('fail'); }, CFG))
        .rejects.toThrow('fail');
    }
    expect(getBreakerState(NAME)).toBe('open');
  });

  it('fail-fast with BreakerOpenError when OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(withBreaker(NAME, async () => { throw new Error('fail'); }, CFG))
        .rejects.toThrow();
    }
    // Now the breaker is OPEN — next call should NOT invoke fn
    const fn = vi.fn(async () => 'ok');
    await expect(withBreaker(NAME, fn, CFG)).rejects.toBeInstanceOf(BreakerOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('transitions OPEN → HALF_OPEN after resetTimeout, then CLOSED on probe success', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    for (let i = 0; i < 3; i++) {
      await expect(withBreaker(NAME, async () => { throw new Error('fail'); }, CFG))
        .rejects.toThrow();
    }
    expect(getBreakerState(NAME)).toBe('open');

    // Advance past the reset timeout
    vi.setSystemTime(11_000);
    const result = await withBreaker(NAME, async () => 'recovered', CFG);
    expect(result).toBe('recovered');
    expect(getBreakerState(NAME)).toBe('closed');
  });

  it('returns to OPEN if HALF_OPEN probe fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    for (let i = 0; i < 3; i++) {
      await expect(withBreaker(NAME, async () => { throw new Error('fail'); }, CFG))
        .rejects.toThrow();
    }
    vi.setSystemTime(11_000);
    await expect(withBreaker(NAME, async () => { throw new Error('still bad'); }, CFG))
      .rejects.toThrow('still bad');
    expect(getBreakerState(NAME)).toBe('open');
  });

  it('resets failure counter on first successful call', async () => {
    // 2 failures (below threshold)
    for (let i = 0; i < 2; i++) {
      await expect(withBreaker(NAME, async () => { throw new Error('fail'); }, CFG))
        .rejects.toThrow();
    }
    expect(getBreakerState(NAME)).toBe('closed');
    // success → counter resets
    await withBreaker(NAME, async () => 'ok', CFG);
    // 2 more failures should NOT trip (counter was reset)
    for (let i = 0; i < 2; i++) {
      await expect(withBreaker(NAME, async () => { throw new Error('fail'); }, CFG))
        .rejects.toThrow();
    }
    expect(getBreakerState(NAME)).toBe('closed');
  });
});
