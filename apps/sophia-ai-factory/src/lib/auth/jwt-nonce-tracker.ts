/**
 * JWT Nonce Tracker
 *
 * Prevents replay attacks by tracking JWT jti claims.
 * Uses KV cache for fast nonce validation with DB fallback.
 *
 * @module auth/jwt-nonce-tracker
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Nonce cache structure for KV storage
 */
interface NonceCache {
  used: boolean;
  userId: string;
  expiresAt: number;
}

/**
 * Cloudflare KV binding type
 */
declare global {
  // eslint-disable-next-line no-var
  var KV_KV: {
    get: (key: string) => Promise<NonceCache | null>;
    set: (key: string, value: NonceCache, options?: { expirationTtl?: number }) => Promise<void>;
  } | undefined;
}

/**
 * Get KV client (lazy init for Cloudflare Workers)
 */
function getKvClient() {
  return typeof globalThis !== 'undefined' && globalThis.KV_KV ? globalThis.KV_KV : null;
}

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
}> {
  if (!nonce || nonce.length < 8) {
    return { valid: false, reason: 'invalid' };
  }

  // Try KV cache first
  const kv = getKvClient();
  if (kv) {
    try {
      const key = `nonce:${nonce}`;
      const cached = await kv.get(key);

      if (cached) {
        // Check if already used
        if (cached.used) {
          logger.warn('[JWT Nonce] Replay attempt detected (KV cache)', {
            nonce: nonce.slice(0, 8) + '...',
          });
          return { valid: false, reason: 'already-used' };
        }

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (cached.expiresAt < now) {
          return { valid: false, reason: 'expired' };
        }

        return { valid: true };
      }
    } catch (error) {
      logger.error('[JWT Nonce] KV cache read error', error as Error);
      // Fall through to DB query
    }
  }

  // Fallback: Database query
  try {
    const db = createServerClient();

    const { data, error } = await db
      .from('jwt_nonces')
      .select('used_at, expires_at')
      .eq('nonce', nonce)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      logger.error('[JWT Nonce] Database error', error as Error);
      return { valid: false, reason: 'invalid' };
    }

    // Nonce not found = first use (valid)
    if (!data) {
      return { valid: true };
    }

    // Check if already used
    if (data.used_at) {
      logger.warn('[JWT Nonce] Replay attempt detected (DB)', {
        nonce: nonce.slice(0, 8) + '...',
      });
      return { valid: false, reason: 'already-used' };
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (data.expires_at < now) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true };
  } catch (error) {
    logger.error('[JWT Nonce] Error checking nonce', error as Error);
    // Fail open on error
    return { valid: true };
  }
}

/**
 * Mark JWT nonce as used (called after successful validation)
 *
 * @param nonce - JWT jti claim
 * @param userId - User ID
 * @param expiresAt - Nonce expiration timestamp (seconds)
 */
export async function markJwtNonceAsUsed(
  nonce: string,
  userId: string,
  expiresAt: number
): Promise<boolean> {
  const kv = getKvClient();
  const now = Math.floor(Date.now() / 1000);

  // Update KV cache (fast path)
  if (kv) {
    try {
      const key = `nonce:${nonce}`;
      await kv.set(key, { used: true, userId, expiresAt }, { expirationTtl: expiresAt - now });
    } catch (error) {
      logger.error('[JWT Nonce] KV cache write error', error as Error);
      // Continue to DB write
    }
  }

  // Database write (authoritative)
  try {
    const db = createServerClient();

    const { error } = await db
      .from('jwt_nonces')
      .insert({
        nonce,
        user_id: userId,
        issued_at: now,
        expires_at: Math.floor(expiresAt),
        used_at: now,
      })
      .onConflict('nonce')
      .update({ used_at: now });

    if (error) {
      logger.error('[JWT Nonce] Failed to mark nonce as used', error as Error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[JWT Nonce] Error marking nonce as used', error as Error);
    return false;
  }
}

/**
 * Pre-register nonce (called when JWT is created)
 * This allows proactive cache warming
 *
 * @param nonce - JWT jti claim
 * @param userId - User ID
 * @param expiresAt - Nonce expiration timestamp (seconds)
 */
export async function preRegisterNonce(
  nonce: string,
  userId: string,
  expiresAt: number
): Promise<boolean> {
  const kv = getKvClient();

  // Pre-register in KV (not marked as used yet)
  if (kv) {
    try {
      const key = `nonce:${nonce}`;
      const ttl = expiresAt - Math.floor(Date.now() / 1000);
      await kv.set(key, { used: false, userId, expiresAt }, { expirationTtl: ttl });
      return true;
    } catch (error) {
      logger.error('[JWT Nonce] KV pre-registration error', error as Error);
    }
  }

  return false;
}

/**
 * Cleanup expired nonces (cron job)
 * Should be run hourly via scheduled function
 */
export async function cleanupExpiredNonces(): Promise<number> {
  const kv = getKvClient();
  const now = Math.floor(Date.now() / 1000);

  // KV cleanup (if using ephemeral KV)
  // Note: Cloudflare KV auto-expires based on TTL, so this is optional

  // Database cleanup
  try {
    const db = createServerClient();

    const { data, error } = await db
      .from('jwt_nonces')
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (error) {
      logger.error('[JWT Nonce] Cleanup failed', error as Error);
      return 0;
    }

    const count = data?.length || 0;
    logger.info('[JWT Nonce] Cleanup complete', { deletedCount: count });

    return count;
  } catch (error) {
    logger.error('[JWT Nonce] Cleanup error', error as Error);
    return 0;
  }
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

    // Get counts in parallel
    const [activeResult, expiredResult] = await Promise.all([
      db
        .from('jwt_nonces')
        .select('id', { count: 'exact', head: true })
        .gte('expires_at', now),
      db
        .from('jwt_nonces')
        .select('id', { count: 'exact', head: true })
        .lt('expires_at', now),
    ]);

    return {
      totalActive: (activeResult.count as number) || 0,
      expiredCount: (expiredResult.count as number) || 0,
      replayAttemptsDetected: 0, // Would need separate tracking table
    };
  } catch (error) {
    logger.error('[JWT Nonce] Stats error', error as Error);
    return { totalActive: 0, expiredCount: 0, replayAttemptsDetected: 0 };
  }
}
