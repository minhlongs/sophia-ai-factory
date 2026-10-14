/**
 * Atomic Credit Slot Reservation
 *
 * Layer: tree/usage-metering
 */

import { getD1 } from '@/seed/db/client';
import { QUOTA_LIMITS, currentYearMonth } from './constants';
import type { CreditSlotReservation } from '../types';

/**
 * Atomically reserve one credit slot for `tenantId` at the given tier.
 *
 * Uses a single UPSERT with `WHERE count < limit` predicate — identical to
 * the pattern in `reserveVideoSlot()` in `src/forest/quota/video-quota.ts`.
 * This eliminates the read-then-increment TOCTOU race between checkQuota()
 * and trackUsage().
 *
 * Returns `reserved=false` when the limit is reached or tier has no quota.
 */
export async function reserveCreditSlot(
  tenantId: string,
  tier: string,
  licenseNonce: string,
  requestedCredits: number = 1,
): Promise<CreditSlotReservation> {
  const quotaLimit = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;
  // Check monthly limit first — this is the tightest constraint and
  // the one that the atomic table tracks.
  const monthlyLimit = quotaLimit.monthlyCredits;

  if (monthlyLimit === 0) {
    return { reserved: false, used: 0, limit: monthlyLimit };
  }

  const yearMonth = currentYearMonth();
  const now = new Date().toISOString();
  const _d1 = await getD1();
  if (!_d1) throw new Error('D1 database binding not available');
  const d1 = _d1;

  // Atomic UPSERT: creates row (count=requestedCredits) on first use,
  // increments on subsequent use, WHERE prevents overflow past limit.
  const { results } = await d1
    .prepare(
      `INSERT INTO credit_usage_monthly (user_id, license_nonce, year_month, count, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(user_id, license_nonce, year_month) DO UPDATE SET
         count = credit_usage_monthly.count + ?4,
         updated_at = ?5
       WHERE credit_usage_monthly.count < ?6
       RETURNING count`,
    )
    .bind(tenantId, licenseNonce, yearMonth, requestedCredits, now, monthlyLimit)
    .all<{ count: number }>();

  if (results && results.length > 0) {
    return { reserved: true, used: results[0].count, limit: monthlyLimit };
  }

  // Limit reached or row not returned — read current usage for accurate display
  const { results: existing } = await d1
    .prepare(
      `SELECT count FROM credit_usage_monthly
       WHERE user_id = ?1 AND license_nonce = ?2 AND year_month = ?3`,
    )
    .bind(tenantId, licenseNonce, yearMonth)
    .all<{ count: number }>();

  const used = (existing && existing.length > 0) ? existing[0].count : monthlyLimit;
  return { reserved: false, used, limit: monthlyLimit };
}
