/**
 * Video Quota KV & D1 Storage Helpers
 *
 * @module quota/quota-enforcer-video-store
 */

import { logger } from '@/seed/utils/logger-utility';

export function getKv(): KVNamespace | null {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).KV_KV) {
    return (globalThis as Record<string, unknown>).KV_KV as KVNamespace;
  }
  return null;
}

function getD1(): D1Database | null {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  return globalDb ?? null;
}

/** Current YYYYMM string for cache key partitioning */
export function currentYYYYMM(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/** KV cache key for video quota */
export function videoCacheKey(tenantId: string, yyyymm: string): string {
  return `quota:video:${tenantId}:${yyyymm}`;
}

/** Read current month video count from D1 (source of truth) */
async function readVideoCountFromDb(tenantId: string): Promise<number> {
  const db = await getD1();
  if (!db) return 0;

  const yyyymm = currentYYYYMM();
  const monthStart = new Date(`${yyyymm.slice(0, 4)}-${yyyymm.slice(4)}-01T00:00:00Z`).getTime();

  try {
    const row = await db
      .prepare(
        'SELECT COUNT(*) AS cnt FROM video_jobs WHERE tenant_id = ? AND created_at >= ?'
      )
      .bind(tenantId, Math.floor(monthStart / 1000))
      .first<{ cnt: number }>();
    return row?.cnt ?? 0;
  } catch (err) {
    logger.error('[VideoQuota] DB read error', { tenantId, err });
    return 0;
  }
}

/** Get video count: KV cache first, then DB. TTL 60s. */
export async function getVideoCount(tenantId: string): Promise<number> {
  const kv = getKv();
  const yyyymm = currentYYYYMM();
  const key = videoCacheKey(tenantId, yyyymm);

  if (kv) {
    try {
      const cached = await kv.get(key);
      if (cached !== null) return parseInt(cached, 10);
    } catch {
      // cache miss — fall through
    }
  }

  const count = await readVideoCountFromDb(tenantId);

  if (kv) {
    kv.put(key, String(count), { expirationTtl: 60 }).catch(() => {});
  }

  return count;
}
