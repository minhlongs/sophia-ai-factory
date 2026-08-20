/**
 * Quota Enforcer — Video Quota Extension (Phase 11)
 *
 * Pre-check + post-debit pattern for per-tenant video limits.
 * KV cache with 60s TTL. Cache key: quota:video:{tenantId}:{YYYYMM}
 *
 * @module quota/quota-enforcer-video
 */

import { logger } from '@/seed/utils/logger-utility';
import { VIDEO_TIER_CONFIG, toVideoTierKey } from '@/seed/config/tiers/video-quota-tiers';
import type { VideoTierKey } from '@/seed/config/tiers/video-quota-tiers';

/** HTTP 429 error thrown when video quota is exceeded */
export class QuotaExceededError extends Error {
  public readonly status = 429;

  constructor(
    message: string,
    public readonly tier: string,
    public readonly limit: number,
    public readonly used: number,
  ) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

function getKv(): KVNamespace | null {
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
function currentYYYYMM(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/** KV cache key for video quota */
function videoCacheKey(tenantId: string, yyyymm: string): string {
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
async function getVideoCount(tenantId: string): Promise<number> {
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

/**
 * Check if tenant can create another video this month.
 * Throws QuotaExceededError (429) if limit exceeded.
 *
 * @param tenantId - Tenant identifier (from resolveTenantId)
 * @param tier - DB tier string (e.g. 'free', 'pro', 'enterprise', 'BASIC', 'PREMIUM')
 */
export async function checkVideoQuota(tenantId: string, tier: string): Promise<void> {
  const tierKey: VideoTierKey = toVideoTierKey(tier);
  const limits = VIDEO_TIER_CONFIG[tierKey];

  // -1 means unlimited
  if (limits.videosPerMonth === -1) return;

  const used = await getVideoCount(tenantId);

  if (used >= limits.videosPerMonth) {
    logger.warn('[VideoQuota] Quota exceeded', {
      tenantId,
      tier,
      tierKey,
      used,
      limit: limits.videosPerMonth,
    });
    throw new QuotaExceededError(
      `Video quota exceeded: ${used}/${limits.videosPerMonth} videos this month.`,
      tierKey,
      limits.videosPerMonth,
      used,
    );
  }
}

/**
 * Debit video quota post-write — invalidates KV cache so next read is fresh.
 *
 * @param tenantId - Tenant identifier
 */
export async function debitVideoQuota(tenantId: string): Promise<void> {
  const kv = getKv();
  if (!kv) return;

  const key = videoCacheKey(tenantId, currentYYYYMM());
  try {
    await kv.delete(key);
  } catch (err) {
    logger.error('[VideoQuota] Cache invalidation error', { tenantId, err });
  }
}
