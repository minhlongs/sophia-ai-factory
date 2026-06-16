/**
 * Rate Limiting Module
 * Centralized exports for rate limiting utilities
 */

export {
  RateLimiter,
  globalRateLimiter,
  getClientIdentifier,
  createRateLimitHeaders,
  createRateLimitResponse
} from './rate-limiter'

export type {
  RateLimitConfig,
  RateLimitResult
} from './rate-limiter'

export {
  RATE_LIMITS,
  ENDPOINT_RULES,
  getRateLimitConfig,
  shouldSkipRateLimit
} from './rate-limit-config'

export type {
  EndpointRateLimit
} from './rate-limit-config'

export {
  withRateLimit,
  checkRateLimit,
  getRateLimitStatus,
  rateLimitMiddleware
} from './rate-limit-wrapper'

export type {
  RateLimitOptions
} from './rate-limit-wrapper'

export {
  withAuth,
  requireAuthJson,
  requireAuthOrThrow,
  checkAuth,
  isPublicApiRoute,
  AuthError,
  AuthGuardOptions,
} from './auth-guard'
