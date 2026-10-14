import { logger } from '@/seed/utils/logger-utility';
import type { LocalD1Database } from './types';
import { SQLiteD1Database } from './database';
import { findLocalD1Path } from './sqlite-finder';

/**
 * Get local SQLite D1 fallback database if wrangler D1 is not available.
 * Returns null if not running in development/test or if local database file doesn't exist.
 */
export function getLocalD1Mock(): LocalD1Database | null {
  if (
    typeof (globalThis as Record<string, unknown>).EdgeRuntime !== 'undefined' &&
    process.env.NODE_ENV === 'production'
  ) {
    return null;
  }

  const sqlitePath = findLocalD1Path();
  if (sqlitePath) {
    try {
      return new SQLiteD1Database(sqlitePath);
    } catch (e) {
      logger.error(
        '[D1 mock] Failed to initialize local D1 database mock',
        e instanceof Error ? e : new Error(String(e))
      );
    }
  }

  // Fallback for test runners (CI/Vitest) where local wrangler state hasn't been initialized
  if (process.env.NODE_ENV === 'test' || process.env.VITEST || !sqlitePath) {
    try {
      return new SQLiteD1Database(':memory:');
    } catch (e) {
      logger.error(
        '[D1 mock] Failed to initialize in-memory SQLite D1 database mock',
        e instanceof Error ? e : new Error(String(e))
      );
      return null;
    }
  }

  logger.warn('[D1 mock] Local wrangler state D1 sqlite not found. Did you run pnpm dev/setup?');
  return null;
}
