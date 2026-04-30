/**
 * rate-limit.ts — KV-backed token bucket rate limiter
 * Phase 12: OpenClaw Orchestrator primitive
 *
 * Uses Cloudflare KV (globalThis.__env.KV) for distributed state.
 * Falls back to in-memory map for local dev / tests.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number; // seconds until bucket refills
}

interface BucketState {
  tokens: number;
  windowStart: number; // epoch ms
}

// In-memory fallback (used when KV unavailable)
const _memoryBuckets = new Map<string, BucketState>();

function getKV(): KVNamespace | null {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.KV && typeof (env.KV as KVNamespace).get === 'function') {
    return env.KV as KVNamespace;
  }
  return null;
}

function bucketKey(tenantId: string, resource: string): string {
  return `rl:${tenantId}:${resource}`;
}

async function readBucket(key: string): Promise<BucketState | null> {
  const kv = getKV();
  if (kv) {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as BucketState;
  }
  return _memoryBuckets.get(key) ?? null;
}

async function writeBucket(
  key: string,
  state: BucketState,
  ttlSec: number,
): Promise<void> {
  const kv = getKV();
  if (kv) {
    await kv.put(key, JSON.stringify(state), { expirationTtl: ttlSec });
  } else {
    _memoryBuckets.set(key, state);
    // Self-expire from memory map
    setTimeout(() => _memoryBuckets.delete(key), ttlSec * 1000);
  }
}

/**
 * Token bucket gate.
 * @param tenantId  Tenant scoping key
 * @param resource  Resource name (e.g. 'video-gen', 'api-calls')
 * @param limit     Max tokens per window
 * @param windowSec Window duration in seconds
 */
export async function rateLimitGate(
  tenantId: string,
  resource: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const key = bucketKey(tenantId, resource);
  const now = Date.now();
  const windowMs = windowSec * 1000;

  let bucket = await readBucket(key);

  // New or expired window
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { tokens: limit, windowStart: now };
  }

  if (bucket.tokens <= 0) {
    const retryAfter = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  bucket.tokens -= 1;
  await writeBucket(key, bucket, windowSec);

  return { allowed: true, remaining: bucket.tokens };
}

/** Test helper: clear in-memory buckets */
export function _clearMemoryBuckets(): void {
  _memoryBuckets.clear();
}
