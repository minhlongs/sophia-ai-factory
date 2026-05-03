/**
 * Rate Limiting Middleware for Cloudflare Workers
 * In-memory LRU cache with sliding window algorithm
 *
 * Note: In Cloudflare Workers, each isolate has its own memory.
 * This provides best-effort rate limiting. For strict limits, use Redis/Upstash.
 */

import { NextResponse } from 'next/server'

export interface RateLimitConfig {
  intervalMs: number      // Time window in milliseconds
  maxRequests: number     // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number         // Unix timestamp (ms)
  retryAfter?: number     // Seconds to wait (if blocked)
}

/**
 * LRU Cache entry for rate limiting
 */
interface CacheEntry {
  timestamps: number[]    // Request timestamps within current window
  expiresAt: number       // When this entry should be evicted
}

/**
 * In-memory rate limiter with LRU eviction
 * Thread-safe for serverless environments (each instance isolated)
 */
export class RateLimiter {
  private cache = new Map<string, CacheEntry>()
  private readonly maxCacheSize: number

  constructor(maxCacheSize: number = 10000) {
    this.maxCacheSize = maxCacheSize
  }

  /**
   * Check if request is allowed under rate limit
   * Uses sliding window algorithm
   */
  checkLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now()
    const windowStart = now - config.intervalMs

    // Get or create entry
    let entry = this.cache.get(key)

    if (!entry) {
      // New key - allow request
      entry = {
        timestamps: [now],
        expiresAt: now + config.intervalMs * 2
      }
      this.cache.set(key, entry)
      this.evictIfNecessary()

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: now + config.intervalMs
      }
    }

    // Filter out timestamps outside the window (sliding window)
    const validTimestamps = entry.timestamps.filter(ts => ts > windowStart)

    if (validTimestamps.length >= config.maxRequests) {
      // Rate limit exceeded
      const oldestTimestamp = validTimestamps[0]
      const resetAt = oldestTimestamp + config.intervalMs
      const retryAfter = Math.ceil((resetAt - now) / 1000)

      // Update entry with cleaned timestamps
      entry.timestamps = validTimestamps
      entry.expiresAt = resetAt + config.intervalMs
      this.cache.set(key, entry)

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter
      }
    }

    // Allow request - add current timestamp
    validTimestamps.push(now)
    entry.timestamps = validTimestamps
    entry.expiresAt = now + config.intervalMs * 2
    this.cache.set(key, entry)

    return {
      allowed: true,
      remaining: config.maxRequests - validTimestamps.length,
      resetAt: now + config.intervalMs
    }
  }

  /**
   * Evict oldest entries if cache exceeds max size
   */
  private evictIfNecessary(): void {
    if (this.cache.size <= this.maxCacheSize) return

    // Convert to array and sort by expiration
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt)

    // Remove oldest 10%
    const toRemove = Math.floor(this.maxCacheSize * 0.1)
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  /**
   * Clear all cached entries (useful for testing)
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get current cache size (for monitoring)
   */
  get size(): number {
    return this.cache.size
  }
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.remaining + (result.allowed ? 0 : 1)),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt)
  }

  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter)
  }

  return headers
}

/**
 * Create 429 Too Many Requests response
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const headers = createRateLimitHeaders(result)

  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: result.retryAfter
    },
    {
      status: 429,
      headers
    }
  )
}

/**
 * Get client identifier for rate limiting
 * Priority: API Key > IP Address
 */
export function getClientIdentifier(request: Request): string {
  // Check for API key in headers
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) {
    return `apikey:${apiKey}`
  }

  // Fall back to IP address
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0].trim()
    return `ip:${ip}`
  }

  // Last resort: use a default key (will rate limit all anonymous together)
  return 'ip:anonymous'
}

// Singleton instance for global rate limiting
// Each Cloudflare Worker isolate will have its own limiter
export const globalRateLimiter = new RateLimiter()
