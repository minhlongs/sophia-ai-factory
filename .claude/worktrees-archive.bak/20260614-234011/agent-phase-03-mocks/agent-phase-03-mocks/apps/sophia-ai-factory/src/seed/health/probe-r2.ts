/**
 * R2 connectivity probe — HEAD sentinel object, times out at 1500ms.
 * Treats 404 as 'up' (binding works, sentinel object merely absent).
 * Caches result 30s.
 */
import type { R2Bucket } from '@cloudflare/workers-types';

export interface ProbeResult {
  status: 'up' | 'down';
  latency: number;
  error?: string;
}

const SENTINEL_KEY = 'health-check.txt';
let cachedResult: ProbeResult | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 30_000;
const TIMEOUT_MS = 1_500;

export async function probeR2(bucket: R2Bucket): Promise<ProbeResult> {
  const now = Date.now();
  if (cachedResult && now < cacheExpiry) return cachedResult;

  const start = now;
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('R2 probe timeout')), TIMEOUT_MS)
    );
    await Promise.race([
      bucket.head(SENTINEL_KEY),
      timeoutPromise,
    ]);
    // head() returns null if object not found — that is still 'up' (binding reachable)
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
