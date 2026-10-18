/**
 * D1 rate limit sliding-window execution helper.
 *
 * @module seed/security/d1-rate-limiter-window
 */

import type { D1Database } from '@/seed/db/client';
import {
  ensureRateLimitTable,
  type D1RateLimitConfig,
  type D1RateLimitResult,
} from './d1-rate-limiter-schema';

/**
 * Ensures the D1 rate-limit table exists, purges expired entries best-effort,
 * increments or resets the client's window counter, and returns the verdict.
 */
export async function executeRateLimitWindow(
  db: D1Database,
  clientId: string,
  now: number,
  cutoff: number,
  config: D1RateLimitConfig,
): Promise<D1RateLimitResult> {
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
    counter = 1;
    windowStart = now;
    await db
      .prepare(
        'INSERT OR REPLACE INTO d1_rate_limits (client_id, counter, window_start) VALUES (?1, 1, ?2)',
      )
      .bind(clientId, now)
      .run();
  } else {
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
}
