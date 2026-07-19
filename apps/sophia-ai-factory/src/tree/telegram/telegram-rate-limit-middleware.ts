/**
 * Rate limit middleware using SQL sliding window
 * Replaces Redis sorted set with Supabase PostgreSQL
 * Prevents abuse by limiting commands per user per minute
 */

import { checkRateLimit as checkSqlRateLimit } from '@/tree/telegram/sql-rate-limiter'

const MAX_COMMANDS_PER_MINUTE = 10
const WINDOW_SECONDS = 60

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number  // Unix timestamp when limit resets
  retryAfter: number  // Seconds to wait
}

/**
 * Check if user is within rate limits
 * Supports both:
 *   - checkRateLimit(chatId) — backward compatible
 *   - checkRateLimit(userId, chatId, limit?, windowSec?) — new API
 */
export async function checkRateLimit(
  arg1: string,
  arg2?: string,
  limit?: number,
  windowSec?: number
): Promise<RateLimitResult> {
  // Determine arguments pattern
  const isNewApi = arg2 !== undefined;
  const chatId = isNewApi ? arg2 : arg1;
  const actualLimit = limit ?? MAX_COMMANDS_PER_MINUTE;
  const actualWindow = windowSec ?? WINDOW_SECONDS;

  const result = await checkSqlRateLimit(chatId, actualLimit, actualWindow)

  // Compute retryAfter and resetAt from remaining and resetInSeconds
  const resetAt = Math.floor(Date.now() / 1000) + result.resetInSeconds
  const retryAfter = result.allowed ? 0 : result.resetInSeconds

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt,
    retryAfter,
  }
}
