/**
 * JWT Nonce Storage - KV and Database Operations
 *
 * Low-level storage operations for JWT nonce tracking.
 * Handles KV cache reads/writes and DB queries/mutations.
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  getKvClient,
  readNonceFromKv,
  writeNonceToKv,
  type NonceCache,
} from './jwt-nonce-kv';

export { getKvClient, readNonceFromKv, writeNonceToKv };
export type { NonceCache };

/**
 * Query nonce from database
 *
 * @returns DB row or null if not found
 */
export async function queryNonceFromDb(nonce: string): Promise<{
  used_at: number | null;
  expires_at: number;
} | null> {
  try {
    const db = createServerClient();

    const { data, error } = await db
      .from('jwt_nonces')
      .select('used_at, expires_at')
      .eq('nonce', nonce)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      logger.error('[JWT Nonce] Database error', toError(error));
      return null;
    }

    return data as { used_at: number | null; expires_at: number } | null;
  } catch (error) {
    logger.error('[JWT Nonce] Error querying nonce', toError(error));
    return null;
  }
}

/**
 * Upsert nonce record into database as used
 */
export async function upsertNonceInDb(
  nonce: string,
  userId: string,
  expiresAt: number
): Promise<boolean> {
  try {
    const db = createServerClient();
    const now = Math.floor(Date.now() / 1000);

    const { error } = await db
      .from('jwt_nonces')
      .upsert({
        nonce,
        user_id: userId,
        issued_at: now,
        expires_at: Math.floor(expiresAt),
        used_at: now,
      });

    if (error) {
      logger.error('[JWT Nonce] Failed to mark nonce as used', toError(error));
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[JWT Nonce] Error marking nonce as used', toError(error));
    return false;
  }
}

/**
 * Delete expired nonces from the database
 *
 * @returns Count of deleted records
 */
export async function deleteExpiredNoncesFromDb(): Promise<number> {
  try {
    const db = createServerClient();
    const now = Math.floor(Date.now() / 1000);

    const { data, error } = await db
      .from('jwt_nonces')
      .delete()
      .lt('expires_at', now)
      .select('nonce');

    if (error) {
      logger.error('[JWT Nonce] Cleanup failed', toError(error));
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    logger.error('[JWT Nonce] Cleanup error', toError(error));
    return 0;
  }
}
