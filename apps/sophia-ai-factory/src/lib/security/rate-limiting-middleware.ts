/**
 * Rate Limiting Middleware
 * SQL-based rate limiting using Supabase PostgreSQL
 * Replaces Redis-based implementation for better compliance
 */

import { checkRateLimit as checkSqlRateLimit, RATE_LIMITS, getClientIdentifier } from './sql-rate-limiter'
import type { RateLimitConfig, RateLimitResult } from './sql-rate-limiter'
import { logger } from '../utils/logger-utility'

export type { RateLimitConfig, RateLimitResult }
export { RATE_LIMITS, getClientIdentifier }

/**
 * Check rate limit for a given identifier (IP, user ID, etc.)
 * Delegates to SQL-based implementation
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return checkSqlRateLimit(identifier, config)
}
