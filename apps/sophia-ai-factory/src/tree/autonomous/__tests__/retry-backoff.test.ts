import { describe, expect, it } from 'vitest';
import {
  calculateBackoff,
  DEFAULT_BACKOFF_CONFIG,
} from '../retry-backoff';

describe('Autonomous Retry & Backoff Evaluator', () => {
  it('calculates exponential backoff progression for attempts 0, 1, 2 without jitter', () => {
    // Attempt 0 (first retry): base = 60s
    const eval0 = calculateBackoff(0, { jitterPct: 0.2 }, 0);
    expect(eval0.shouldRetry).toBe(true);
    expect(eval0.nextAttempt).toBe(1);
    expect(eval0.delayMs).toBe(60_000);
    expect(eval0.exhausted).toBe(false);

    // Attempt 1 (second retry): 60s * 2^1 = 120s
    const eval1 = calculateBackoff(1, { jitterPct: 0.2 }, 0);
    expect(eval1.shouldRetry).toBe(true);
    expect(eval1.nextAttempt).toBe(2);
    expect(eval1.delayMs).toBe(120_000);

    // Attempt 2 (third retry): 60s * 2^2 = 240s
    const eval2 = calculateBackoff(2, { jitterPct: 0.2 }, 0);
    expect(eval2.shouldRetry).toBe(true);
    expect(eval2.nextAttempt).toBe(3);
    expect(eval2.delayMs).toBe(240_000);
  });

  it('applies jitter within expected bounds', () => {
    const rawDelay = 60_000;
    const jitterPct = 0.2; // up to +20% (12,000ms)

    // With minimum jitter (randomFloat = 0)
    const minEval = calculateBackoff(0, { jitterPct }, 0);
    expect(minEval.delayMs).toBe(rawDelay);

    // With maximum jitter (randomFloat = 1)
    const maxEval = calculateBackoff(0, { jitterPct }, 1);
    expect(maxEval.delayMs).toBe(rawDelay * (1 + jitterPct));

    // With 50% jitter (randomFloat = 0.5)
    const midEval = calculateBackoff(0, { jitterPct }, 0.5);
    expect(midEval.delayMs).toBe(rawDelay + rawDelay * jitterPct * 0.5);
  });

  it('caps delay at maxDelayMs regardless of attempt exponent', () => {
    const maxDelayMs = 1_800_000; // 30 minutes
    const res = calculateBackoff(10, { maxDelayMs, maxRetries: 20 }, 0);
    expect(res.delayMs).toBe(maxDelayMs);
  });

  it('reports exhausted when attempt reaches maxRetries', () => {
    // Default maxRetries is 3
    const res = calculateBackoff(3, { maxRetries: 3 });
    expect(res.shouldRetry).toBe(false);
    expect(res.exhausted).toBe(true);
    expect(res.delayMs).toBe(0);
    expect(res.nextAttempt).toBe(4);
  });

  it('correctly calculates nextRunAtMs using provided now timestamp', () => {
    const now = 1_700_000_000_000;
    const res = calculateBackoff(0, { now }, 0);
    expect(res.nextRunAtMs).toBe(now + res.delayMs);
  });
});
