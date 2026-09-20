import { describe, it, expect } from 'vitest';
import { TokenBucket } from '@/tree/payouts/token-bucket';

describe('Token Bucket (tree/payouts/token-bucket)', () => {
  it('initializes with specified capacity and refill rate', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRatePerSecond: 5 });
    expect(bucket.getAvailableTokens()).toBe(5);
  });

  it('tryAcquire consumes tokens when available', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRatePerSecond: 5 });
    expect(bucket.tryAcquire(2)).toBe(true);
    expect(bucket.getAvailableTokens()).toBeLessThanOrEqual(3.05);
    expect(bucket.tryAcquire(3)).toBe(true);
    expect(bucket.tryAcquire(1)).toBe(false);
  });

  it('acquire resolves asynchronously and paces token consumption', async () => {
    const bucket = new TokenBucket({ capacity: 2, refillRatePerSecond: 10 });

    // Consume all tokens
    await bucket.acquire(1);
    await bucket.acquire(1);

    const start = Date.now();
    // Next acquisition must wait for refill (1 token at 10/s => ~100ms)
    await bucket.acquire(1);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(50);
  });
});
