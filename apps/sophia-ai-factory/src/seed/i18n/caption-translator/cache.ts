/**
 * KV Cache and hashing helpers for caption translator.
 * @module seed/i18n/caption-translator/cache
 */

import { logger } from '@/seed/utils/logger-utility';

export const CACHE_TTL_SECONDS = 2_592_000; // 30 days

/** SHA-256 (edge-safe, Web Crypto) */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Retrieve KVNamespace binding for experiment KV */
export async function getKv(): Promise<KVNamespace | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const env = ctx.env as Record<string, unknown>;
    return (env.EXPERIMENT_KV as KVNamespace) ?? null;
  } catch {
    return null;
  }
}

/** Read translation from KV cache */
export async function getCachedTranslation(cacheKey: string): Promise<string | null> {
  const kv = await getKv();
  if (!kv) return null;
  try {
    return await kv.get(cacheKey);
  } catch (err) {
    logger.warn(`[caption-translator] KV get failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Store translation in KV cache (fire-and-forget) */
export async function setCachedTranslation(cacheKey: string, value: string): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  kv.put(cacheKey, value, { expirationTtl: CACHE_TTL_SECONDS }).catch((err: unknown) => {
    logger.warn(`[caption-translator] KV put failed: ${err instanceof Error ? err.message : String(err)}`);
  });
}
