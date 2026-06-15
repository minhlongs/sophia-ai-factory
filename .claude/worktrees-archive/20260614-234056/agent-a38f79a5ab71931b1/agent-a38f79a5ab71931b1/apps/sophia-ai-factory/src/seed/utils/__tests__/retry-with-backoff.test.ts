/**
 * Tests for withRetry exponential backoff utility.
 * Covers: happy path, max retries exhausted, BreakerOpenError skip, delay bounds.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry } from '../retry-with-backoff';
import { BreakerOpenError } from '../circuit-breaker';

// Replace real setTimeout with vitest fake timers for delay tests
describe('withRetry', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('returns result immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('done');
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 });
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds on second attempt', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error('transient');
      return 'ok';
    });

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 5, jitter: false });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws last error after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent'));
    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 5, jitter: false }),
    ).rejects.toThrow('persistent');
    // 1 initial + 2 retries = 3 total calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on BreakerOpenError — throws immediately', async () => {
    const fn = vi.fn().mockRejectedValue(new BreakerOpenError('test'));
    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 5, jitter: false }),
    ).rejects.toBeInstanceOf(BreakerOpenError);
    // Must not retry — only 1 call
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('delay stays within [base, maxDelay] bounds (no jitter)', async () => {
    vi.useFakeTimers();
    let resolveFirst: (() => void) | undefined;

    const fn = vi.fn(async () => {
      // Fail first two attempts, succeed on third
      if (fn.mock.calls.length < 3) throw new Error('fail');
      return 'success';
    });

    const retryPromise = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 500,
      jitter: false,
    });

    // Advance through delays
    await vi.runAllTimersAsync();
    const result = await retryPromise;
    expect(result).toBe('success');
    vi.useRealTimers();
  });

  it('uses default config when no options provided', async () => {
    const fn = vi.fn().mockResolvedValue('default');
    const result = await withRetry(fn);
    expect(result).toBe('default');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('partial config override merges with defaults', async () => {
    // maxRetries=1 only, rest defaults
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(
      withRetry(fn, { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 5, jitter: false }),
    ).rejects.toThrow('fail');
    // 1 initial + 1 retry = 2 total
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
