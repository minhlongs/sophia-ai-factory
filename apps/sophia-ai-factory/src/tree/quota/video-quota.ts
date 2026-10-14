/**
 * Video Quota Enforcement — per-user, per-month counter.
 *
 * Uses a separate `video_usage_monthly` table (NOT the credit/nonce billing
 * system) to keep video rate-limiting decoupled from payment flows.
 */

import { getD1 } from '@/seed/db/client';
import {
  VIDEO_QUOTA_BY_TIER,
  currentYearMonth,
  nextMonthResetAt,
  readVideoUsage,
  invalidateVideoQuotaEdgeCache,
  type VideoQuotaStatus,
  type VideoSlotReservation,
} from './video-quota-helpers';

export {
  VIDEO_QUOTA_BY_TIER,
  type VideoQuotaStatus,
  type VideoSlotReservation,
} from './video-quota-helpers';

/**
 * Read current quota status without mutating anything.
 */
export async function checkVideoQuota(
  userId: string,
  tier: string,
): Promise<VideoQuotaStatus> {
  const limit = VIDEO_QUOTA_BY_TIER[tier] ?? 0;
  const yearMonth = currentYearMonth();
  const used = await readVideoUsage(userId, yearMonth);
  return { allowed: used < limit, used, limit, resetAt: nextMonthResetAt() };
}

/**
 * Atomically reserve one video slot for `userId` at the given tier.
 */
export async function reserveVideoSlot(
  userId: string,
  tier: string,
): Promise<VideoSlotReservation> {
  const limit = VIDEO_QUOTA_BY_TIER[tier] ?? 0;
  const yearMonth = currentYearMonth();
  const resetAt = nextMonthResetAt();

  if (limit === 0) {
    const used = await readVideoUsage(userId, yearMonth);
    return { reserved: false, used, limit, resetAt };
  }

  const now = new Date().toISOString();
  const d1 = await getD1();
  if (!d1) throw new Error('D1 database binding not available');
  const { results } = await d1
    .prepare(
      `INSERT INTO video_usage_monthly (user_id, year_month, count, updated_at)
       VALUES (?1, ?2, 1, ?3)
       ON CONFLICT(user_id, year_month) DO UPDATE SET
         count = video_usage_monthly.count + 1,
         updated_at = ?3
       WHERE video_usage_monthly.count < ?4
       RETURNING count`,
    )
    .bind(userId, yearMonth, now, limit)
    .all<{ count: number }>();

  await invalidateVideoQuotaEdgeCache(userId, yearMonth);

  if (results && results.length > 0) {
    return { reserved: true, used: results[0].count, limit, resetAt };
  }

  const used = await readVideoUsage(userId, yearMonth);
  return { reserved: false, used, limit, resetAt };
}

/**
 * Best-effort decrement after a downstream failure.
 */
export async function releaseVideoSlot(userId: string): Promise<void> {
  const yearMonth = currentYearMonth();
  const now = new Date().toISOString();
  const d1 = await getD1();
  if (!d1) throw new Error('D1 database binding not available');
  await d1
    .prepare(
      `UPDATE video_usage_monthly
       SET count = count - 1, updated_at = ?3
       WHERE user_id = ?1 AND year_month = ?2 AND count > 0`,
    )
    .bind(userId, yearMonth, now)
    .run();

  await invalidateVideoQuotaEdgeCache(userId, yearMonth);
}

/**
 * @deprecated Use `reserveVideoSlot` for the create flow.
 */
export async function incrementVideoUsage(userId: string): Promise<void> {
  const yearMonth = currentYearMonth();
  const now = new Date().toISOString();
  const d1 = await getD1();
  if (!d1) throw new Error('D1 database binding not available');
  await d1
    .prepare(
      `INSERT INTO video_usage_monthly (user_id, year_month, count, updated_at)
       VALUES (?1, ?2, 1, ?3)
       ON CONFLICT(user_id, year_month) DO UPDATE SET
         count = video_usage_monthly.count + 1,
         updated_at = ?3`,
    )
    .bind(userId, yearMonth, now)
    .run();

  await invalidateVideoQuotaEdgeCache(userId, yearMonth);
}
