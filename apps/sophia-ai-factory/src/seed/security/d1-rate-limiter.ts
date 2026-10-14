/**
 * D1-Backed Rate Limiter
 *
 * Provides cross-isolate rate limiting using Cloudflare D1.
 * Unlike the in-memory RateLimiter class, counters persist across
 * CF Worker isolates, preventing attackers from bypassing limits
 * by distributing requests across isolates.
 *
 * Uses INSERT OR REPLACE pattern for atomic UPSERT.
 * Fail-closed: on D1 errors, logs error and denies request.
 * A rate-limit failure must never become a bypass.
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  AUTH_RATE_LIMIT_CONFIG,
  ensureRateLimitTable,
  isPermanentRateLimitError,
  type D1RateLimitConfig,
  type D1RateLimitResult,
} from './d1-rate-limiter-schema';

export {
  AUTH_RATE_LIMIT_CONFIG,
  type D1RateLimitConfig,
  type D1RateLimitResult,
} from './d1-rate-limiter-schema';

/**
 * Check rate limit using D1-backed counter.
 *
 * Uses INSERT OR REPLACE pattern for atomic UPSERT.
 * Cross-isolate: counters persist across CF Worker isolates.
 * Fail-open: on D1 error, logs error and allows request.
 */
export async function checkD1RateLimit(
  clientId: string,
  config: D1RateLimitConfig = AUTH_RATE_LIMIT_CONFIG,
): Promise<D1RateLimitResult> {
  // Skip rate limit only when explicitly disabled (test environments)
  if (globalThis.process?.env?.DISABLE_RATE_LIMIT === 'true') {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: Math.floor(Date.now() / 1000) + config.windowSeconds,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - config.windowSeconds;

  const db = await getD1();
  if (!db) {
    // Fail-closed: if D1 is unavailable, deny the request.
    // A rate-limit check failure must never become an auth bypass.
    logger.error('D1 rate limit: D1 binding unavailable, denying request');
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + config.windowSeconds,
    };
  }

  try {
    // Ensure table exists (idempotent, per-isolate cache)
    await ensureRateLimitTable(db);

    // Clean up expired entries inline (best-effort, non-fatal)
    try {
      await db
        .prepare('DELETE FROM d1_rate_limits WHERE window_start < ?1')
        .bind(cutoff)
        .run();
    } catch {
      // Cleanup failure is non-fatal
    }

    // Read current entry for this client
    const existing = await db
      .prepare(
        'SELECT counter, window_start FROM d1_rate_limits WHERE client_id = ?1',
      )
      .bind(clientId)
      .first<{ counter: number; window_start: number }>();

    let counter: number;
    let windowStart: number;

    if (!existing || existing.window_start < cutoff) {
      // New window or expired — start fresh with counter=1
      counter = 1;
      windowStart = now;
      await db
        .prepare(
          'INSERT OR REPLACE INTO d1_rate_limits (client_id, counter, window_start) VALUES (?1, 1, ?2)',
        )
        .bind(clientId, now)
        .run();
    } else {
      // Existing window — increment counter
      counter = existing.counter + 1;
      windowStart = existing.window_start;
      await db
        .prepare(
          'UPDATE d1_rate_limits SET counter = counter + 1 WHERE client_id = ?1',
        )
        .bind(clientId)
        .run();
    }

    const resetAt = windowStart + config.windowSeconds;

    if (counter > config.maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - counter,
      resetAt,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    if (isPermanentRateLimitError(error.message)) {
      logger.error('D1 rate limit: PERMANENT ERROR - failing closed', {
        error: error.message,
      });
      return {
        allowed: false,
        remaining: 0,
        resetAt: Math.floor(Date.now() / 1000) + config.windowSeconds,
      };
    }

    // Fail-closed on ALL errors (transient or permanent).
    // A D1 hiccup during a brute-force burst must not become an auth bypass.
    logger.error('D1 rate limit check failed, denying request', error);
    return {
      allowed: false,
      remaining: 0,
      resetAt: Math.floor(Date.now() / 1000) + config.windowSeconds,
    };
  }
}
