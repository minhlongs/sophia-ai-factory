/**
 * Rate Limit Configuration for API Endpoints
 * Define rate limits per endpoint pattern
 */

import { RateLimitConfig } from './rate-limiter'

export interface EndpointRateLimit {
  pattern: string           // URL pattern (glob-style)
  config: RateLimitConfig   // Rate limit settings
  description: string       // Human-readable description
}

/**
 * Default rate limits for different endpoint categories
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Public API endpoints - moderate limits
  api: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 30             // 30 requests per minute
  },

  // API v1 endpoints - stricter limits
  apiV1: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 60             // 60 requests per minute
  },

  // Ingestion endpoints - burst allowed
  ingestion: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 100            // 100 requests per minute
  },

  // Admin endpoints - strict limits (sensitive operations)
  admin: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 20             // 20 requests per minute
  },

  // Auth endpoints - very strict (prevent brute force)
  auth: {
    intervalMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10             // 10 requests per 15 minutes
  },

  // Webhook endpoints - high volume allowed
  webhooks: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 200            // 200 requests per minute
  },

  // Health check - very permissive
  health: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 300            // 300 requests per minute
  },

  // Usage tracking - moderate limits
  usage: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 60             // 60 requests per minute
  },

  // Analytics - moderate limits
  analytics: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 30             // 30 requests per minute
  },

  // HeyGen API - rate limited by provider
  heygen: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 20             // 20 requests per minute
  },

  // Setup endpoints - strict (one-time setup)
  setup: {
    intervalMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10             // 10 requests per hour
  },

  // Checkout - strict (prevent abuse)
  checkout: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 10             // 10 requests per minute
  },

  // Discovery/search - moderate limits
  discovery: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 30             // 30 requests per minute
  },

  // Default fallback
  default: {
    intervalMs: 60 * 1000,      // 1 minute
    maxRequests: 30             // 30 requests per minute
  }
}

/**
 * Endpoint-specific rate limit rules
 * Order matters - first match wins
 * Patterns with /** match sub-paths, single * matches exact segment
 */
export const ENDPOINT_RULES: EndpointRateLimit[] = [
  {
    pattern: '/api/auth/*',
    config: RATE_LIMITS.auth,
    description: 'Authentication endpoints'
  },
  {
    pattern: '/api/auth',
    config: RATE_LIMITS.auth,
    description: 'Authentication root endpoint'
  },
  {
    pattern: '/api/v1/*',
    config: RATE_LIMITS.apiV1,
    description: 'API v1 endpoints'
  },
  {
    pattern: '/api/v1',
    config: RATE_LIMITS.apiV1,
    description: 'API v1 root endpoint'
  },
  {
    pattern: '/api/ingestion/*',
    config: RATE_LIMITS.ingestion,
    description: 'Data ingestion endpoints'
  },
  {
    pattern: '/api/admin/*',
    config: RATE_LIMITS.admin,
    description: 'Admin endpoints'
  },
  {
    pattern: '/api/webhooks/*',
    config: RATE_LIMITS.webhooks,
    description: 'Webhook endpoints'
  },
  {
    pattern: '/api/health',
    config: RATE_LIMITS.health,
    description: 'Health check endpoint'
  },
  {
    pattern: '/api/usage/*',
    config: RATE_LIMITS.usage,
    description: 'Usage tracking endpoints'
  },
  {
    pattern: '/api/analytics/*',
    config: RATE_LIMITS.analytics,
    description: 'Analytics endpoints'
  },
  {
    pattern: '/api/heygen/*',
    config: RATE_LIMITS.heygen,
    description: 'HeyGen integration endpoints'
  },
  {
    pattern: '/api/setup/*',
    config: RATE_LIMITS.setup,
    description: 'Setup wizard endpoints'
  },
  {
    pattern: '/api/checkout',
    config: RATE_LIMITS.checkout,
    description: 'Checkout endpoint'
  },
  {
    pattern: '/api/discovery/*',
    config: RATE_LIMITS.discovery,
    description: 'Discovery/search endpoints'
  },
  {
    pattern: '/api/*',
    config: RATE_LIMITS.api,
    description: 'General API endpoints'
  }
]

/**
 * Match URL path to rate limit config
 * Returns the first matching rule or default
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
 * Supports * (any chars) and ** (any path depth including empty)
 */
function matchesPattern(pathname: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // ** matches any path (including empty)
  // * matches any chars except /
  const regexPattern = pattern
    .replace(/\*\*/g, '__DOUBLE_STAR__')  // Temp placeholder
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*')    // ** matches everything including empty

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(pathname)
}

/**
 * Check if path should skip rate limiting
 */
export function shouldSkipRateLimit(pathname: string): boolean {
  // Skip rate limiting for static assets
  if (pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/i)) {
    return true
  }

  // Skip rate limiting for Next.js internal routes
  if (pathname.startsWith('/_next/') || pathname.startsWith('/__nextjs')) {
    return true
  }

  return false
}
