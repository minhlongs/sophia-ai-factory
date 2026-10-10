export interface RateLimitConfig {
  intervalMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface CacheEntry {
  timestamps: number[];
  expiresAt: number;
}
