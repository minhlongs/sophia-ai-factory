import { NextResponse } from 'next/server';
import type { RateLimitConfig } from '../rate-limiter';

export interface RateLimitOptions {
  /**
   * Custom rate limit config (overrides auto-detected)
   */
  config?: RateLimitConfig;

  /**
   * Custom key for rate limiting (overrides IP/API key)
   */
  key?: string;

  /**
   * Skip rate limiting check
   */
  skip?: boolean;

  /**
   * Custom error response
   */
  onRateLimited?: (retryAfter?: number) => NextResponse;

  /**
   * Add rate limit headers to successful responses
   */
  addHeaders?: boolean;
}

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  resetAt: number;
  resetInSeconds: number;
}
