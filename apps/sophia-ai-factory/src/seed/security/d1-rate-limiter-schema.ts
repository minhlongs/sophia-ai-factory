/**
 * D1 Rate Limiter Schema, Config, and Error Classification Helpers
 * @module seed/security/d1-rate-limiter-schema
 */

import type { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface D1RateLimitConfig {
  /** Maximum requests allowed within the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

/** Default auth rate limit: 10 requests per 60 seconds */
export const AUTH_RATE_LIMIT_CONFIG: D1RateLimitConfig = {
  maxRequests: 10,
  windowSeconds: 60,
};

export interface D1RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests within the current window */
  remaining: number;
  /** Unix timestamp (seconds) when the rate limit resets */
  resetAt: number;
}

const PERMANENT_ERROR_PATTERNS = [
  /no such table/i,
  /schema mismatch/i,
  /no such column/i,
  /datatype mismatch/i,
  /UNIQUE constraint/i,
  /NOT NULL constraint/i,
  /FOREIGN KEY constraint/i,
  /syntax error/i,
];

export function isPermanentRateLimitError(message: string): boolean {
  return PERMANENT_ERROR_PATTERNS.some((p) => p.test(message));
}

// ── Per-isolate table creation cache ─────────────────────────────────────

let _tableEnsured = false;

/**
 * Ensure the d1_rate_limits table exists.
 * Uses a per-isolate boolean flag to skip the DDL after first call.
 */
export async function ensureRateLimitTable(db: Awaited<ReturnType<typeof getD1>>): Promise<void> {
  if (_tableEnsured || !db) return;

  try {
    await db
      .prepare(
        'CREATE TABLE IF NOT EXISTS d1_rate_limits (' +
          'client_id TEXT PRIMARY KEY, ' +
          'counter INTEGER NOT NULL DEFAULT 1, ' +
          'window_start INTEGER NOT NULL, ' +
          'created_at INTEGER DEFAULT (unixepoch())' +
          ')',
      )
      .run();
    _tableEnsured = true;
  } catch (err) {
    logger.error(
      'Failed to ensure d1_rate_limits table',
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}
