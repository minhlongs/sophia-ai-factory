/**
 * Token Bucket Rate Limiter
 *
 * Pure Domain Layer (Tree)
 * Guarantees strict request rate limiting (e.g. max 5 req/s) without clock drift.
 *
 * @module tree/payouts/token-bucket
 */

export interface TokenBucketOptions {
  capacity?: number;
  refillRatePerSecond?: number;
}

export class TokenBucket {
  private capacity: number;
  private refillRate: number;
  private tokens: number;
  private lastRefillTimestamp: number;

  constructor(options: TokenBucketOptions = {}) {
    this.capacity = options.capacity ?? 5;
    this.refillRate = options.refillRatePerSecond ?? 5;
    this.tokens = this.capacity;
    this.lastRefillTimestamp = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTimestamp) / 1000;
    if (elapsedSeconds > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillRate);
      this.lastRefillTimestamp = now;
    }
  }

  /**
   * Returns current count of available tokens.
   */
  public getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Non-blocking acquisition attempt. Returns true if acquired, false otherwise.
   */
  public tryAcquire(count = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  /**
   * Asynchronously acquires tokens, waiting if necessary until bucket is refilled.
   */
  public async acquire(count = 1): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= count) {
        this.tokens -= count;
        return;
      }

      const needed = count - this.tokens;
      const waitMs = Math.max(10, Math.ceil((needed / this.refillRate) * 1000));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
