/**
 * Agent API types — API key auth, rate limiting, and request logging.
 * Used by tree/api/agent-api-auth.ts and any API route requiring key-based auth.
 * @module seed/types/agent-api
 */

// ── Permission types ──────────────────────────────────────────────────────────

/** Scoped permissions assignable to an API key. */
export type ApiPermission =
  | 'sop:execute'
  | 'sop:read'
  | 'sop:write'
  | 'outcome:read'
  | 'template:read'
  | 'template:write';

// ── Row types ─────────────────────────────────────────────────────────────────

/**
 * API key record (camelCase, post-mapping from DB snake_case).
 * rawKey is NEVER stored — only keyHash is persisted.
 */
export interface ApiKey {
  id: string;
  userId: string;
  /** SHA-256 hex digest of the raw key. Never expose. */
  keyHash: string;
  /** First 12 chars of the raw key for display identification. */
  keyPrefix: string;
  name: string;
  permissions: ApiPermission[];
  rateLimitRpm: number;
  isActive: boolean;
  lastUsedAt?: number; // Unix seconds
  expiresAt?: number; // Unix seconds, undefined = no expiry
  createdAt: number; // Unix seconds
}

/**
 * API request log entry — tracks usage per API key per endpoint.
 */
export interface ApiRequestLog {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  requestBodySize?: number;
  responseBodySize?: number;
  errorMessage?: string;
  ipAddress?: string;
  createdAt: number; // Unix seconds
}

/**
 * In-memory rate limit state for a single API key in the current 60s window.
 */
export interface ApiRateLimit {
  keyId: string;
  windowStart: number; // Unix seconds
  requestCount: number;
  limitRpm: number;
}

// ── Result types ──────────────────────────────────────────────────────────────

/** Returned once on key creation — rawKey is NOT stored and cannot be retrieved later. */
export interface ApiKeyCreationResult {
  id: string;
  rawKey: string;
  keyPrefix: string;
}

/** Rate limit check result. */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix seconds when the current window resets
}
