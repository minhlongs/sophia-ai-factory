/**
 * JWT Nonce KV Cache Operations
 *
 * Cloudflare KV read/write operations for JWT nonce tracking.
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

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
