/**
 * JWT Nonce Tracker
 *
 * Prevents replay attacks by tracking JWT jti claims.
 * Uses KV cache for fast nonce validation with DB fallback.
 *
 * @module auth/jwt-nonce-tracker
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  readNonceFromKv,
  writeNonceToKv,
  queryNonceFromDb,
  upsertNonceInDb,
  deleteExpiredNoncesFromDb,
} from '@/seed/auth/jwt-nonce-storage';

// Re-export storage primitives for consumers
export type { NonceCache } from './jwt-nonce-storage';

/**
 * Check if JWT nonce has been used (replay attack prevention)
 *
 * Priority:
 * 1. KV cache (fast path)
 * 2. Database query (fallback)
 *
 * @param nonce - JWT jti claim
 * @returns true if nonce is valid (not used), false if replay detected
 */
export async function checkJwtNonce(nonce: string): Promise<{
  valid: boolean;
  reason?: 'already-used' | 'expired' | 'invalid';
  error?: string;
}> {
  if (!nonce || nonce.length < 8) {
    return { valid: false, reason: 'invalid' };
  }

  // Try KV cache first (fast path)
  const cached = await readNonceFromKv(nonce);
  if (cached !== null) {
    if (cached.used) {
      logger.warn('[JWT Nonce] Replay attempt detected (KV cache)', {
        nonce: nonce.slice(0, 8) + '...',
      });
      return { valid: false, reason: 'already-used' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (cached.expiresAt < now) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true };
  }

  // Fallback: Database query
  try {
    const row = await queryNonceFromDb(nonce);

    if (row === null) {
      // queryNonceFromDb returns null both for "not found" and "error"
      // Check DB directly to distinguish
      const db = createServerClient();
      const { data, error } = await db
        .from('jwt_nonces')
        .select('used_at, expires_at')
        .eq('nonce', nonce)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('[JWT Nonce] Database error', toError(error));
        return { valid: false, reason: 'invalid' };
      }

      if (!data) {
        return { valid: true }; // Not found = first use
      }

      const dbRow = data as { used_at: unknown; expires_at: unknown };
      if (dbRow.used_at) {
        logger.warn('[JWT Nonce] Replay attempt detected (DB)', {
          nonce: nonce.slice(0, 8) + '...',
        });
        return { valid: false, reason: 'already-used' };
      }

      const now = Math.floor(Date.now() / 1000);
      if (typeof dbRow.expires_at === 'number' && dbRow.expires_at < now) {
        return { valid: false, reason: 'expired' };
      }

      return { valid: true };
    }

    if (row.used_at) {
      logger.warn('[JWT Nonce] Replay attempt detected (DB)', {
        nonce: nonce.slice(0, 8) + '...',
      });
      return { valid: false, reason: 'already-used' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (row.expires_at < now) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true };
  } catch (error) {
    logger.error('[JWT Nonce] Error checking nonce', toError(error));
    return { valid: false, reason: 'invalid' }; // Fail closed on error
  }
}

/**
 * Mark JWT nonce as used (called after successful validation)
 */
export async function markJwtNonceAsUsed(
  nonce: string,
  userId: string,
  expiresAt: number
): Promise<boolean> {
  // DB first (authoritative) — if this fails, nonce stays usable → fail closed
  const dbResult = await upsertNonceInDb(nonce, userId, expiresAt);
  if (!dbResult) {
    return false; // DB write failed — do not mark as used
  }

  // KV second (cache only — failure is non-fatal; DB is authoritative)
  try {
    await writeNonceToKv(nonce, { used: true, userId, expiresAt }, expiresAt);
  } catch {
    logger.warn(
      '[JWT Nonce] KV cache write failed after DB success — non-fatal',
      { nonce: nonce.slice(0, 8) + '...' },
    );
  }

  return true;
}

/**
 * Pre-register nonce (called when JWT is created)
 * This allows proactive cache warming.
 * Fails closed: returns false if KV is unavailable or write fails.
 */
export async function preRegisterNonce(
  nonce: string,
  userId: string,
  expiresAt: number
): Promise<boolean> {
  // Import here to access getKvClient without circular dependency
  const { getKvClient } = await import('./jwt-nonce-storage');
  const kv = getKvClient();
  if (!kv) {
    logger.warn('[JWT Nonce] KV unavailable — preRegisterNonce returning false (fail-closed)');
    return false;
  }

  try {
    const key = `nonce:${nonce}`;
    const ttl = expiresAt - Math.floor(Date.now() / 1000);
    await kv.set(key, { used: false, userId, expiresAt }, { expirationTtl: ttl });
    return true;
  } catch (error) {
    logger.error('[JWT Nonce] KV write failed in preRegisterNonce', toError(error));
    return false;
  }
}

/**
 * Cleanup expired nonces (cron job)
 * Should be run hourly via scheduled function
 */
export async function cleanupExpiredNonces(): Promise<number> {
  const count = await deleteExpiredNoncesFromDb();
  logger.info('[JWT Nonce] Cleanup complete', { deletedCount: count });
  return count;
}

/**
 * Get nonce statistics for monitoring
 */
export async function getNonceStats(): Promise<{
  totalActive: number;
  expiredCount: number;
  replayAttemptsDetected: number;
}> {
  try {
    const db = createServerClient();
    const now = Math.floor(Date.now() / 1000);

    const [activeResult, expiredResult] = await Promise.all([
      db
        .from('jwt_nonces')
        .select('nonce', { count: 'exact', head: true })
        .gte('expires_at', now),
      db
        .from('jwt_nonces')
        .select('nonce', { count: 'exact', head: true })
        .lt('expires_at', now),
    ]);

    return {
      totalActive: (activeResult.count as number) || 0,
      expiredCount: (expiredResult.count as number) || 0,
      replayAttemptsDetected: 0,
    };
  } catch (error) {
    logger.error('[JWT Nonce] Stats error', toError(error));
    return { totalActive: 0, expiredCount: 0, replayAttemptsDetected: 0 };
  }
}
