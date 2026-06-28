/**
 * Rate Limit Configuration — matcher + skip logic
 * Tier definitions live in rate-limit-tiers.ts
 */

import { RateLimitConfig } from './rate-limiter'
import { RATE_LIMITS, ENDPOINT_RULES } from './rate-limit-tiers'

export type { EndpointRateLimit } from './rate-limit-tiers'
export { RATE_LIMITS, ENDPOINT_RULES } from './rate-limit-tiers'

/**
 * Match URL path to rate limit config — first matching rule wins
 */
export function getRateLimitConfig(pathname: string): RateLimitConfig {
  for (const rule of ENDPOINT_RULES) {
    if (matchesPattern(pathname, rule.pattern)) {
      return rule.config
    }
  }
  return RATE_LIMITS.default
}

/**
 * Simple glob-style pattern matching
 * Supports * (any chars except /) and ** (any path depth)
 */
function matchesPattern(pathname: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*')

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(pathname)
}

/**
 * Check if path should skip rate limiting (static assets, Next.js internals)
 */
export function shouldSkipRateLimit(pathname: string): boolean {
  if (pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/i)) {
    return true
  }
  if (pathname.startsWith('/_next/') || pathname.startsWith('/__nextjs')) {
    return true
  }
  return false
}
