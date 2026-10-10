import { RateLimitConfig, RateLimitResult, CacheEntry } from './types';

export function evaluateSlidingWindow(
  entry: CacheEntry | undefined,
  config: RateLimitConfig,
  now: number,
): { updatedEntry: CacheEntry; result: RateLimitResult } {
  const windowStart = now - config.intervalMs;

  if (!entry) {
    const updatedEntry: CacheEntry = {
      timestamps: [now],
      expiresAt: now + config.intervalMs * 2,
    };
    return {
      updatedEntry,
      result: {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: now + config.intervalMs,
      },
    };
  }

  const validTimestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (validTimestamps.length >= config.maxRequests) {
    const oldestTimestamp = validTimestamps[0];
    const resetAt = oldestTimestamp + config.intervalMs;
    const retryAfter = Math.ceil((resetAt - now) / 1000);

    const updatedEntry: CacheEntry = {
      timestamps: validTimestamps,
      expiresAt: resetAt + config.intervalMs,
    };
    return {
      updatedEntry,
      result: {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      },
    };
  }

  validTimestamps.push(now);
  const updatedEntry: CacheEntry = {
    timestamps: validTimestamps,
    expiresAt: now + config.intervalMs * 2,
  };

  return {
    updatedEntry,
    result: {
      allowed: true,
      remaining: config.maxRequests - validTimestamps.length,
      resetAt: now + config.intervalMs,
    },
  };
}
