export interface RateLimitConfig {
  intervalMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  limit?: number;
}

export interface CacheEntry {
  timestamps: number[];
  expiresAt: number;
}
