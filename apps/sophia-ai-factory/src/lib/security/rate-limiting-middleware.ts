/**
 * Rate Limiting Middleware
 * Sử dụng Upstash Redis để track requests và prevent abuse
 */

import { Redis } from '@upstash/redis';
import { logger } from '../utils/logger-utility';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface RateLimitConfig {
  /**
   * Maximum requests allowed in the window
   */
  maxRequests: number;

  /**
   * Time window in seconds
   */
  windowSeconds: number;

  /**
   * Identifier for this rate limit (e.g., 'api', 'webhook', 'auth')
   */
  identifier: string;
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // API routes: 100 requests per minute
  api: {
    maxRequests: 100,
    windowSeconds: 60,
    identifier: 'api',
  },

  // Webhook endpoints: 1000 requests per minute (high traffic)
  webhook: {
    maxRequests: 1000,
    windowSeconds: 60,
    identifier: 'webhook',
  },

  // Auth routes: 10 requests per minute (prevent brute force)
  auth: {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: 'auth',
  },

  // Admin routes: 50 requests per minute
  admin: {
    maxRequests: 50,
    windowSeconds: 60,
    identifier: 'admin',
  },
} as const;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // Unix timestamp when limit resets
}

/**
 * Check rate limit for a given identifier (IP, user ID, etc.)
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `ratelimit:${config.identifier}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    // Get current count from Redis
    const count = await redis.get<number>(key);
    const currentCount = count || 0;

    if (currentCount >= config.maxRequests) {
      // Rate limit exceeded
      const ttl = await redis.ttl(key);
      return {
        success: false,
        remaining: 0,
        reset: now + (ttl || config.windowSeconds),
      };
    }

    // Increment counter
    await redis.incr(key);

    // Set expiry on first request in window
    if (currentCount === 0) {
      await redis.expire(key, config.windowSeconds);
    }

    return {
      success: true,
      remaining: config.maxRequests - (currentCount + 1),
      reset: now + config.windowSeconds,
    };
  } catch (error) {
    logger.error('Rate limit check failed', error instanceof Error ? error : new Error(String(error)));
    // Fail closed: deny request if Redis is down to prevent abuse
    return {
      success: false,
      remaining: 0,
      reset: now + config.windowSeconds,
    };
  }
}

/**
 * Get client identifier from request (IP address or user ID)
 */
export function getClientIdentifier(
  request: Request,
  userId?: string
): string {
  // Prefer user ID if authenticated
  if (userId) {
    return `user:${userId}`;
  }

  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0] || 'unknown';
  return `ip:${ip}`;
}
