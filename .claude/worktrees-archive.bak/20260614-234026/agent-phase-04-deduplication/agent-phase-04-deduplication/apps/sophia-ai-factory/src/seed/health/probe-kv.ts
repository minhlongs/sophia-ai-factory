/**
 * KV connectivity probe — GET sentinel key, times out at 1500ms.
 * Treats null value (key absent) as 'up' (binding works).
 * Caches result 30s. Binding: EXPERIMENT_KV (wrangler.toml).
 */
import type { KVNamespace } from '@cloudflare/workers-types';

export interface ProbeResult {
  status: 'up' | 'down';
  latency: number;
  error?: string;
}

const SENTINEL_KEY = 'health:ping';
let cachedResult: ProbeResult | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 30_000;
const TIMEOUT_MS = 1_500;

export async function probeKv(kv: KVNamespace): Promise<ProbeResult> {
  const now = Date.now();
  if (cachedResult && now < cacheExpiry) return cachedResult;

  const start = now;
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('KV probe timeout')), TIMEOUT_MS)
    );
    await Promise.race([
      kv.get(SENTINEL_KEY),
      timeoutPromise,
    ]);
    // get() returns null if key absent — still 'up' (binding reachable)
    const result: ProbeResult = { status: 'up', latency: Date.now() - start };
    cachedResult = result;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return result;
  } catch (err) {
    const result: ProbeResult = {
      status: 'down',
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown',
    };
    cachedResult = result;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return result;
  }
}
