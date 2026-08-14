import { createServerClient, getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { QUOTA_LIMITS } from '@/seed/config/quota-limits';
import type { QuotaLimit } from '@/seed/types/quota-limit';
import type { CachedQuota } from './quota-checker-types';

interface QuotaLimitsRow {
  custom_daily_credits: number | null;
  custom_hourly_credits: number | null;
  custom_monthly_credits: number | null;
  custom_daily_requests: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface CreditsUsedRow {
  credits_used: number | null;
}

/**
 * Get effective quota limits (DB override > tier defaults).
 * Priority: quota_limits table (custom per-license) > QUOTA_LIMITS constant (tier defaults).
 */
export async function getEffectiveQuotaLimits(
  licenseNonce: string,
  tier: string
): Promise<QuotaLimit> {
  try {
    const db = createServerClient();
    const { data: rawCustom, error } = await db
      .from('quota_limits')
      .select('*')
      .eq('license_nonce', licenseNonce)
      .single();
    const custom = rawCustom as QuotaLimitsRow | null;

    const defaultLimit = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;

    if (error || !custom) {
      return defaultLimit;
    }

    return {
      tier,
      dailyCredits: custom.custom_daily_credits ?? defaultLimit.dailyCredits,
      hourlyCredits: custom.custom_hourly_credits ?? defaultLimit.hourlyCredits,
      monthlyCredits: custom.custom_monthly_credits ?? defaultLimit.monthlyCredits,
      dailyRequests: custom.custom_daily_requests ?? defaultLimit.dailyRequests,
    };
  } catch (error) {
    logger.error('[Quota Checker] Error fetching quota limits', toError(error));
    return QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;
  }
}

/**
 * Calculate current usage from database.
 * Uses rolling time windows: current hour, current day, current month.
 */
export async function calculateCurrentUsage(
  userId: string,
  licenseNonce: string
): Promise<CachedQuota> {
  const now = Math.floor(Date.now() / 1000);

  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) / 1000);

  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;
    const result = await db
      .prepare(
        `SELECT
          SUM(CASE WHEN created_at >= ? AND created_at < ? THEN credits_used ELSE 0 END) AS hourly_credits,
          SUM(CASE WHEN created_at >= ? AND created_at < ? THEN credits_used ELSE 0 END) AS daily_credits,
          SUM(CASE WHEN created_at >= ? THEN credits_used ELSE 0 END) AS monthly_credits,
          COUNT(CASE WHEN created_at >= ? AND created_at < ? THEN 1 END) AS daily_requests
         FROM usage_events
         WHERE user_id = ? AND license_nonce = ? AND created_at >= ?`
      )
      .bind(
        hourStart,
        hourStart + 3600,
        dayStart,
        dayStart + 86400,
        monthStart,
        dayStart,
        dayStart + 86400,
        userId,
        licenseNonce,
        monthStart
      )
      .first<{
        hourly_credits: number | null;
        daily_credits: number | null;
        monthly_credits: number | null;
        daily_requests: number | null;
      }>();

    return {
      hourly: result?.hourly_credits ?? 0,
      daily: result?.daily_credits ?? 0,
      monthly: result?.monthly_credits ?? 0,
      requests: result?.daily_requests ?? 0,
    };
  } catch (error) {
    logger.error('[Quota Checker] Error calculating usage', toError(error));
    return { hourly: 0, daily: 0, monthly: 0, requests: 0 };
  }
}
