/**
 * Quota Limit Checker
 *
 * Layer: tree/usage-metering
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { QUOTA_LIMITS } from './constants';
import type { QuotaCheckResult } from '../types';

/**
 * Check quota limits for a tenant
 */
export async function checkQuota(
  tenantId: string,
  licenseNonce: string,
  tier: string,
  requestedCredits: number = 1
): Promise<QuotaCheckResult> {
  const quotaLimit = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000);

  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).getTime() / 1000
  );

  try {
    // Single aggregated query replaces three separate queries and JS rollup
    const result = await db
      .prepare(`
        SELECT
          SUM(CASE WHEN created_at >= ? AND created_at < ? THEN credits_used ELSE 0 END) AS hourly_credits,
          SUM(CASE WHEN created_at >= ? AND created_at < ? THEN credits_used ELSE 0 END) AS daily_credits,
          SUM(CASE WHEN created_at >= ? THEN credits_used ELSE 0 END) AS monthly_credits,
          COUNT(CASE WHEN created_at >= ? AND created_at < ? THEN 1 END) AS daily_requests
        FROM usage_events
        WHERE user_id = ? AND license_nonce = ? AND created_at >= ?
      `)
      .bind(
        hourStart, hourStart + 3600,
        dayStart, dayStart + 86400,
        monthStart,
        dayStart, dayStart + 86400,
        tenantId, licenseNonce, monthStart
      )
      .first<{
        hourly_credits: number | null;
        daily_credits: number | null;
        monthly_credits: number | null;
        daily_requests: number | null;
      }>();

    const hourlyCredits = result?.hourly_credits ?? 0;
    const dailyCredits = result?.daily_credits ?? 0;
    const monthlyCredits = result?.monthly_credits ?? 0;
    const dailyRequests = result?.daily_requests ?? 0;

    const remaining = {
      dailyCredits: Math.max(0, quotaLimit.dailyCredits - dailyCredits),
      hourlyCredits: Math.max(0, quotaLimit.hourlyCredits - hourlyCredits),
      dailyRequests: Math.max(0, quotaLimit.dailyRequests - dailyRequests),
      monthlyCredits: Math.max(0, quotaLimit.monthlyCredits - monthlyCredits),
    };

    if (hourlyCredits + requestedCredits > quotaLimit.hourlyCredits) {
      return { allowed: false, remaining, exceeded: { type: 'hourly_credits', limit: quotaLimit.hourlyCredits, current: hourlyCredits } };
    }
    if (dailyCredits + requestedCredits > quotaLimit.dailyCredits) {
      return { allowed: false, remaining, exceeded: { type: 'daily_credits', limit: quotaLimit.dailyCredits, current: dailyCredits } };
    }
    if (monthlyCredits + requestedCredits > quotaLimit.monthlyCredits) {
      return { allowed: false, remaining, exceeded: { type: 'monthly_credits', limit: quotaLimit.monthlyCredits, current: monthlyCredits } };
    }
    if (dailyRequests + 1 > quotaLimit.dailyRequests) {
      return { allowed: false, remaining, exceeded: { type: 'daily_requests', limit: quotaLimit.dailyRequests, current: dailyRequests } };
    }

    return { allowed: true, remaining };
  } catch (error) {
    logger.error('[Quota Check] Error checking quota', error instanceof Error ? error : new Error(String(error)));
    // Fail closed — deny request if quota check errors; caller should surface to user for retry
    return { allowed: false, remaining: { dailyCredits: 0, hourlyCredits: 0, dailyRequests: 0, monthlyCredits: 0 } };
  }
}
