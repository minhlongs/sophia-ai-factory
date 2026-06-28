/**
 * Server-side HeyGen health check helper.
 *
 * Used by the pricing page server component to determine whether to gate
 * the One-Time Bundle CTA. Reads from KV cache (60s TTL) to avoid
 * calling HeyGen on every page load.
 *
 * Returns true when HeyGen is reachable, false otherwise.
 *
 * @module lib/health/heygen-health-check
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { HeyGenHealthResponse } from '@/app/api/health/heygen/route';

const KV_CACHE_KEY = 'health:heygen';
const KV_CACHE_TTL_SECONDS = 60;
const HEYGEN_PING_TIMEOUT_MS = 5_000;

async function pingHeyGen(apiKey: string): Promise<HeyGenHealthResponse> {
  const checkedAt = new Date().toISOString();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEYGEN_PING_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch('https://api.heygen.com/v2/voices?limit=1', {
        method: 'GET',
        headers: { 'X-Api-Key': apiKey, accept: 'application/json' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (res.ok || res.status === 401) {
      return { healthy: true, providerStatus: 'ok', checkedAt };
    }
    if (res.status >= 500) {
      return { healthy: false, providerStatus: 'down', checkedAt, details: `HeyGen returned ${res.status}` };
    }
    return { healthy: false, providerStatus: 'degraded', checkedAt, details: `HeyGen returned ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('abort') || msg.includes('timeout');
    return {
      healthy: false,
      providerStatus: 'down',
      checkedAt,
      details: isTimeout ? 'HeyGen ping timed out after 5s' : `Network error: ${msg}`,
    };
  }
}

/**
 * Returns true if HeyGen is reachable. Uses KV cache when available.
 * Never throws — returns false on any error.
 */
export async function isHeyGenHealthy(): Promise<boolean> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return false;

  let kv: KVNamespace | null = null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const cfCtx = await getCloudflareContext();
    const env = cfCtx.env as Record<string, unknown>;
    kv = (env.EXPERIMENT_KV as KVNamespace) ?? null;
  } catch {
    // Local dev — no KV
  }

  if (kv) {
    try {
      const cached = await kv.get(KV_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as HeyGenHealthResponse;
        return parsed.healthy;
      }
    } catch {
      // Fall through to live check
    }
  }

  const result = await pingHeyGen(apiKey);

  if (kv) {
    try {
      await kv.put(KV_CACHE_KEY, JSON.stringify(result), { expirationTtl: KV_CACHE_TTL_SECONDS });
    } catch {
      // Non-fatal
    }
  }

  return result.healthy;
}
