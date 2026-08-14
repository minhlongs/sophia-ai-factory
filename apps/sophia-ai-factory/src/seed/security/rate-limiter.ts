/**
 * Rate Limiter Utility
 * Wrapper around SQL-based rate limiting for easy API usage
 *
 * Extended for RaaS Gateway Audit API with API key rate limiting
 */

import { checkRateLimit as checkSqlRateLimit, RATE_LIMITS } from '@/seed/security/sql-rate-limiter'
import type { RateLimitConfig, RateLimitResult as SqlRateLimitResult } from '@/seed/security/sql-rate-limiter'
import { logger } from '@/seed/utils/logger-utility'

/**
 * Rate limit result for API routes
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

/**
 * Simple rate limit function for API routes
 * @param identifier - IP address or user ID
 * @param action - Action type (e.g., 'receipt_generation')
 * @param maxRequests - Max requests allowed
 * @param windowSeconds - Time window in seconds
 * @returns Object with allowed boolean and reset timestamp
 */
export async function rateLimit(
  identifier: string,
  action: string,
  maxRequests: number = 100,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; resetAt: number }> {
  const fullIdentifier = `${action}:${identifier}`

  const config: RateLimitConfig = {
    maxRequests,
    windowSeconds,
    identifier: action,
  }

  const result = await checkSqlRateLimit(fullIdentifier, config)

  return {
    allowed: result.success,
    resetAt: result.reset,
  }
}

/**
 * Check rate limit for API key
 * Default: 100 requests per minute
 *
 * @param apiKeyId - API key ID
 * @param limit - Rate limit per minute (default 100)
 * @returns Rate limit result
 */
export async function checkRateLimit(
  apiKeyId: string,
  limit: number = 100
): Promise<RateLimitResult> {
  const identifier = `api-key:${apiKeyId}`
  const windowSeconds = 60 // 1 minute

  const config: RateLimitConfig = {
    maxRequests: limit,
    windowSeconds,
    identifier,
  }

  const sqlResult: SqlRateLimitResult = await checkSqlRateLimit(identifier, config)

  const result: RateLimitResult = {
    allowed: sqlResult.success,
    remaining: sqlResult.remaining,
    resetAt: sqlResult.reset,
  }

  // Add retryAfter for rate-limited responses
  if (!sqlResult.success) {
    result.retryAfter = Math.ceil((sqlResult.reset - Date.now()) / 1000)
  }

  return result
}

/**
 * Record a request for rate limiting
 * Called after successful API key validation
 *
 * @param apiKeyId - API key ID
 */
export async function recordRequest(apiKeyId: string): Promise<void> {
  // Rate limiting is handled by checkRateLimit via SQL function
  // which already increments the counter
  logger.debug('[Rate Limiter] Request recorded for API key', { apiKeyId })
}

// Re-export RATE_LIMITS for convenience
export { RATE_LIMITS }
