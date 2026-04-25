import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';
import type { QuotaLimit } from '@/lib/usage-metering/types';
import type { CachedQuota } from './quota-checker-types';

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
    const { data: custom, error } = await db
      .from('quota_limits')
      .select('*')
      .eq('license_nonce', licenseNonce)
      .single();

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
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  try {
    const [hourlyResult, dailyResult, monthlyResult] = await Promise.all([
      db
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', hourStart)
        .lt('created_at', hourStart + 3600),

      db
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', dayStart)
        .lt('created_at', dayStart + 86400),

      db
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', monthStart),
    ]);

    const hourlyCredits = (hourlyResult.data ?? []).reduce(
      (sum, row) => sum + (row.credits_used ?? 0),
      0
    );
    const dailyCredits = (dailyResult.data ?? []).reduce(
      (sum, row) => sum + (row.credits_used ?? 0),
      0
    );
    const monthlyCredits = (monthlyResult.data ?? []).reduce(
      (sum, row) => sum + (row.credits_used ?? 0),
      0
    );

    return {
      hourly: hourlyCredits,
      daily: dailyCredits,
      monthly: monthlyCredits,
      requests: dailyResult.data?.length ?? 0,
    };
  } catch (error) {
    logger.error('[Quota Checker] Error calculating usage', toError(error));
    return { hourly: 0, daily: 0, monthly: 0, requests: 0 };
  }
}
