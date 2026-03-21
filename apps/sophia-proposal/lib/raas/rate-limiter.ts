/**
 * RaaS Rate Limiter
 *
 * Sliding window rate limiter for external API endpoints.
 * Uses in-memory Map with periodic cleanup.
 * Checks per-key rate_limit_per_minute from raas_api_keys.
 */

interface WindowEntry {
  timestamps: number[];
  limit: number;
}

const windows = new Map<string, WindowEntry>();
const WINDOW_MS = 60_000; // 1 minute sliding window
const CLEANUP_INTERVAL_MS = 300_000; // 5 min

// Periodic cleanup of expired entries
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);
      if (entry.timestamps.length === 0) windows.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow process to exit without waiting for cleanup
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * Check and consume one request from the rate limit window.
 * Returns whether the request is allowed + headers info.
 */
export function checkRateLimit(keyId: string, limitPerMinute: number): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  let entry = windows.get(keyId);

  if (!entry) {
    entry = { timestamps: [], limit: limitPerMinute };
    windows.set(keyId, entry);
  }

  // Update limit if changed
  entry.limit = limitPerMinute;

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);

  const remaining = Math.max(0, limitPerMinute - entry.timestamps.length);
  const oldestInWindow = entry.timestamps[0] ?? now;
  const resetMs = oldestInWindow + WINDOW_MS - now;

  if (entry.timestamps.length >= limitPerMinute) {
    return { allowed: false, limit: limitPerMinute, remaining: 0, resetMs };
  }

  // Consume one request
  entry.timestamps.push(now);

  return {
    allowed: true,
    limit: limitPerMinute,
    remaining: remaining - 1,
    resetMs,
  };
}

/**
 * Generate standard rate limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
  };
}
