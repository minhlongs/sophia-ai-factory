/**
 * D1 connectivity probe — runs SELECT 1, times out at 1500ms.
 * Caches result for 30s to prevent D1 free-tier exhaustion.
 */
import type { D1Database } from '@cloudflare/workers-types';

export interface ProbeResult {
  status: 'up' | 'down';
  latency: number;
  error?: string;
}

let cachedResult: ProbeResult | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 30_000;
const TIMEOUT_MS = 1_500;

export async function probeD1(db: D1Database): Promise<ProbeResult> {
  const now = Date.now();
  if (cachedResult && now < cacheExpiry) return cachedResult;

  const start = now;
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('D1 probe timeout')), TIMEOUT_MS)
    );
    await Promise.race([
      db.prepare('SELECT 1').first(),
      timeoutPromise,
    ]);
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
