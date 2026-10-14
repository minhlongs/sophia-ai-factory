import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  readNonceFromKv,
  queryNonceFromDb,
} from '@/seed/auth/jwt-nonce-storage';
import type { NonceCheckResult } from './types';

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
export async function checkJwtNonce(nonce: string): Promise<NonceCheckResult> {
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
