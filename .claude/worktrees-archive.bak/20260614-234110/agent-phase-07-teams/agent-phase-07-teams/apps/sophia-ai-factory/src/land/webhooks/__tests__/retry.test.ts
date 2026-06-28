/**
 * Unit tests for webhook retry backoff schedule.
 * @module lib/webhooks/__tests__/retry.test
 */

import { describe, it, expect } from 'vitest';
import { nextRetryDelay, nextRetryAt, isDeadLetter, MAX_ATTEMPTS } from '../retry';

describe('retry backoff schedule', () => {
  it('MAX_ATTEMPTS is 5', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });

  it('attempt 1 → 30 seconds (30000ms)', () => {
    expect(nextRetryDelay(1)).toBe(30_000);
  });

  it('attempt 2 → 2 minutes (120000ms)', () => {
    expect(nextRetryDelay(2)).toBe(120_000);
  });

  it('attempt 3 → 10 minutes (600000ms)', () => {
    expect(nextRetryDelay(3)).toBe(600_000);
  });

  it('attempt 4 → 1 hour (3600000ms)', () => {
    expect(nextRetryDelay(4)).toBe(3_600_000);
  });

  it('attempt 5 (max) → 0 (no more retries)', () => {
    expect(nextRetryDelay(5)).toBe(0);
  });

  it('delay is monotonically increasing for attempts 1-4', () => {
    const delays = [1, 2, 3, 4].map(nextRetryDelay);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it('nextRetryAt returns null when maxed out', () => {
    expect(nextRetryAt(5)).toBeNull();
  });

  it('nextRetryAt returns ISO string for attempt 1', () => {
    const result = nextRetryAt(1);
    expect(result).not.toBeNull();
    expect(() => new Date(result!).toISOString()).not.toThrow();
  });

  it('isDeadLetter is true at MAX_ATTEMPTS', () => {
    expect(isDeadLetter(MAX_ATTEMPTS)).toBe(true);
  });

  it('isDeadLetter is false below MAX_ATTEMPTS', () => {
    expect(isDeadLetter(1)).toBe(false);
    expect(isDeadLetter(4)).toBe(false);
  });
});
