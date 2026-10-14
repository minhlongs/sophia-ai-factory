/**
 * Sliding window rate limiting for agent API.
 * @module tree/api/agent-auth/rate-limiter
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { RateLimitResult } from '@/seed/types/agent-api';

/**
 * Check rate limit for the current 60s window using request log counts.
 * Fails closed (returns allowed:false) on DB error.
 */
export async function checkRateLimit(apiKeyId: string): Promise<RateLimitResult> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - 60;

    const keyRow = await db
      .prepare(`SELECT rate_limit_rpm FROM api_keys WHERE id = ?`)
      .bind(apiKeyId)
      .first<{ rate_limit_rpm: number }>();

    const limitRpm = keyRow?.rate_limit_rpm ?? 60;

    const countRow = await db
      .prepare(
        `SELECT COUNT(*) as cnt FROM api_request_log WHERE api_key_id = ? AND created_at >= ?`,
      )
      .bind(apiKeyId, windowStart)
      .first<{ cnt: number }>();

    const count = countRow?.cnt ?? 0;
    return {
      allowed: count < limitRpm,
      remaining: Math.max(0, limitRpm - count),
      resetAt: windowStart + 60,
    };
  } catch (err) {
    logger.error('Rate limit check error', { apiKeyId, error: getErrorMessage(err) });
    return { allowed: false, remaining: 0, resetAt: Math.floor(Date.now() / 1000) + 60 };
  }
}
