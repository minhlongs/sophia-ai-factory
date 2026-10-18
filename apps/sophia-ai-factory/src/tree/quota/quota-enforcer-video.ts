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
import {
  getKv,
  currentYYYYMM,
  videoCacheKey,
  getVideoCount,
} from './quota-enforcer-video-store';

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
