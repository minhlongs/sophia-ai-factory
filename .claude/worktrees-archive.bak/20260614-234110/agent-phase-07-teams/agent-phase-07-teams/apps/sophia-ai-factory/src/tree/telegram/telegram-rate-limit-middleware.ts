/**
 * Rate limit middleware using SQL sliding window
 * Replaces Redis sorted set with Supabase PostgreSQL
 * Prevents abuse by limiting commands per user per minute
 */

import { checkRateLimit as checkSqlRateLimit } from '@/tree/telegram/sql-rate-limiter'

const MAX_COMMANDS_PER_MINUTE = 10
const WINDOW_SECONDS = 60

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

/**
 * Check if user is within rate limits
 * Uses SQL-based sliding window via PostgreSQL function
 */
export async function checkRateLimit(chatId: string): Promise<RateLimitResult> {
  return checkSqlRateLimit(chatId, MAX_COMMANDS_PER_MINUTE, WINDOW_SECONDS)
}
