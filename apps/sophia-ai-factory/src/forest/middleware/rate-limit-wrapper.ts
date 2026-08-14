/**
 * Rate Limit Middleware Wrapper for API Routes
 * Higher-order function to wrap API route handlers with rate limiting
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  globalRateLimiter,
  getClientIdentifier,
  createRateLimitResponse,
  createRateLimitHeaders,
  RateLimitConfig
} from './rate-limiter'
import { getRateLimitConfig, shouldSkipRateLimit } from './rate-limit-config'

export interface RateLimitOptions {
  /**
   * Custom rate limit config (overrides auto-detected)
   */
  config?: RateLimitConfig

  /**
   * Custom key for rate limiting (overrides IP/API key)
   */
  key?: string

  /**
   * Skip rate limiting check
   */
  skip?: boolean

  /**
   * Custom error response
   */
  onRateLimited?: (retryAfter?: number) => NextResponse

  /**
   * Add rate limit headers to successful responses
   */
  addHeaders?: boolean
}

/**
 * Wrap an API route handler with rate limiting
 *
 * @example
 * ```ts
 * export const GET = withRateLimit(async (request: NextRequest) => {
 *   // Your handler logic
 *   return NextResponse.json({ data: 'ok' })
 * }, {
 *   config: { intervalMs: 60000, maxRequests: 30 }
 * })
 * ```
 */
export function withRateLimit<T extends NextResponse>(
  handler: (request: NextRequest) => Promise<T>,
  options: RateLimitOptions = {}
) {
  return async function wrappedHandler(request: NextRequest): Promise<T | NextResponse> {
    // Skip if explicitly disabled
    if (options.skip) {
      return handler(request)
    }

    // Resilient URL parse — test mocks may omit `url`. Fall back to '/'.
    let pathname = '/'
    try {
      if (request.url) pathname = new URL(request.url).pathname
    } catch { /* keep '/' */ }

    // Skip rate limiting for static assets and internal routes
    if (shouldSkipRateLimit(pathname)) {
      return handler(request)
    }

    // Get rate limit config for this endpoint
    const config = options.config || getRateLimitConfig(pathname)

    // Get client identifier (IP or API key)
    const clientKey = options.key || getClientIdentifier(request)

    // Check rate limit
    const result = globalRateLimiter.checkLimit(clientKey, config)

    // Create headers for response
    const headers = options.addHeaders !== false ? createRateLimitHeaders(result) : {}

    // Rate limit exceeded
    if (!result.allowed) {
      if (options.onRateLimited) {
        return options.onRateLimited(result.retryAfter) as T | NextResponse
      }

      return createRateLimitResponse(result) as T | NextResponse
    }

    // Execute handler
    const response = await handler(request)

    // Add rate limit headers to response. Guard instanceof — some test mocks
    // shim NextResponse as a plain object so the check throws "instanceof is
    // not callable". Duck-type via headers presence instead.
    try {
      const hasHeaders =
        options.addHeaders !== false &&
        response &&
        typeof (response as { headers?: { set?: (k: string, v: string) => void } }).headers?.set === 'function'
      if (hasHeaders) {
        Object.entries(headers).forEach(([key, value]) => {
          (response as NextResponse).headers.set(key, value)
        })
      }
    } catch { /* mocked Response — skip header injection */ }

    return response
  }
}

/**
 * Check rate limit without wrapping a handler
 * Returns error response if rate limited, null if allowed
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const error = checkRateLimit(request)
 *   if (error) return error
 *
 *   // Handle request...
 * }
 * ```
 */
export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
): NextResponse | null {
  const pathname = new URL(request.url).pathname

  if (options.skip || shouldSkipRateLimit(pathname)) {
    return null
  }

  const config = options.config || getRateLimitConfig(pathname)
  const clientKey = options.key || getClientIdentifier(request)
  const result = globalRateLimiter.checkLimit(clientKey, config)

  if (!result.allowed) {
    if (options.onRateLimited) {
      return options.onRateLimited(result.retryAfter)
    }
    return createRateLimitResponse(result)
  }

  return null
}

/**
 * Get current rate limit status for a client
 * Useful for returning rate limit info in responses
 */
export function getRateLimitStatus(
  request: NextRequest,
  config?: RateLimitConfig
): {
  limit: number
  remaining: number
  resetAt: number
  resetInSeconds: number
} {
  const pathname = new URL(request.url).pathname
  const limitConfig = config || getRateLimitConfig(pathname)
  const _clientKey = getClientIdentifier(request)

  // Peek at current state without incrementing
  // This is a simplified version - just returns the config
  // For accurate remaining count, we'd need to expose peek() from RateLimiter
  const now = Date.now()

  return {
    limit: limitConfig.maxRequests,
    remaining: limitConfig.maxRequests, // Simplified
    resetAt: now + limitConfig.intervalMs,
    resetInSeconds: Math.ceil(limitConfig.intervalMs / 1000)
  }
}

/**
 * Middleware function for Next.js middleware.ts
 * Applies rate limiting at the edge
 */
export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname

  // Skip for non-API routes
  if (!pathname.startsWith('/api/')) {
    return null
  }

  // Skip static assets
  if (shouldSkipRateLimit(pathname)) {
    return null
  }

  const config = getRateLimitConfig(pathname)
  const clientKey = getClientIdentifier(request)
  const result = globalRateLimiter.checkLimit(clientKey, config)

  if (!result.allowed) {
    return createRateLimitResponse(result)
  }

  return null
}
