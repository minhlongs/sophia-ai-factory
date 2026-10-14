import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  writeNonceToKv,
  upsertNonceInDb,
  deleteExpiredNoncesFromDb,
} from '@/seed/auth/jwt-nonce-storage';
import type { NonceStatsResult } from './types';

/**
 * Mark JWT nonce as used (called after successful validation)
 */
export async function markJwtNonceAsUsed(
  nonce: string,
  userId: string,
  expiresAt: number,
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
  expiresAt: number,
): Promise<boolean> {
  // Import here to access getKvClient without circular dependency
  const { getKvClient } = await import('../jwt-nonce-storage');
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
export async function getNonceStats(): Promise<NonceStatsResult> {
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
