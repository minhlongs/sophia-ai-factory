/**
 * JWT Nonce Storage - KV and Database Operations
 *
 * Low-level storage operations for JWT nonce tracking.
 * Handles KV cache reads/writes and DB queries/mutations.
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

/**
 * Nonce cache structure for KV storage
 */
export interface NonceCache {
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
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown, options?: { expirationTtl?: number }) => Promise<void>;
  } | undefined;
}

/**
 * Get KV client (lazy init for Cloudflare Workers)
 */
export function getKvClient() {
  return typeof globalThis !== 'undefined' && globalThis.KV_KV ? globalThis.KV_KV : null;
}

/**
 * Read nonce from KV cache
 *
 * @returns Cached nonce data or null if not found
 */
export async function readNonceFromKv(nonce: string): Promise<NonceCache | null> {
  const kv = getKvClient();
  if (!kv) return null;

  try {
    const key = `nonce:${nonce}`;
    return (await kv.get(key)) as NonceCache | null;
  } catch (error) {
    logger.error('[JWT Nonce] KV cache read error', toError(error));
    return null;
  }
}

/**
 * Write nonce to KV cache
 */
export async function writeNonceToKv(
  nonce: string,
  data: NonceCache,
  expiresAt: number
): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;

  try {
    const key = `nonce:${nonce}`;
    const ttl = expiresAt - Math.floor(Date.now() / 1000);
    await kv.set(key, data, { expirationTtl: ttl });
  } catch (error) {
    logger.error('[JWT Nonce] KV cache write error', toError(error));
  }
}

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
      .select('id');

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
