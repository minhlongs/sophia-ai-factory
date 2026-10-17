/**
 * OpenClaw Bridge quota & affiliate stats helpers.
 * @module land/openclaw-telegram/openclaw-bridge-quota-affiliate
 */

import { createServerClient } from '@/seed/db/client';
import { getQuotaStatus } from '@/tree/quota/quota-checker';
import { QUOTA_LIMITS } from '@/seed/config/quota-limits';
import { getRecentConversions } from '@/land/affiliates/dashboard-stats';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface QuotaInfo {
  tier: string;
  status: string;
  usage: { hourly: number; daily: number; monthly: number; requests: number };
  limits: { hourlyCredits: number; dailyCredits: number; monthlyCredits: number; dailyRequests: number };
  percentages: { hourly: number; daily: number; monthly: number };
}

export async function callGetQuota(userId: string): Promise<QuotaInfo> {
  try {
    const db = createServerClient();
    const { data: license } = await db
      .from('raas_licenses')
      .select('nonce, tier')
      .eq('created_by', userId)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: { nonce: string; tier: string | null } | null };

    if (!license) {
      return {
        tier: 'BASIC',
        usage: { hourly: 0, daily: 0, monthly: 0, requests: 0 },
        limits: QUOTA_LIMITS.BASIC,
        percentages: { hourly: 0, daily: 0, monthly: 0 },
        status: 'ok',
      };
    }

    const tier = (license.tier ?? 'BASIC').toUpperCase();
    const rawStatus = await getQuotaStatus(userId, license.nonce, tier);
    return rawStatus as unknown as QuotaInfo;
  } catch (err) {
    logger.warn('[openclaw-bridge] callGetQuota failed', toError(err));
    return {
      tier: 'unknown',
      status: 'error',
      usage: { hourly: 0, daily: 0, monthly: 0, requests: 0 },
      limits: { hourlyCredits: 0, dailyCredits: 0, monthlyCredits: 0, dailyRequests: 0 },
      percentages: { hourly: 0, daily: 0, monthly: 0 },
    };
  }
}

export interface AffiliateStats {
  count: number;
  conversions: Awaited<ReturnType<typeof getRecentConversions>>;
}

export async function callGetAffiliateStats(
  userId: string,
  limit = 5,
  offset = 0,
): Promise<AffiliateStats> {
  try {
    const conversions = await getRecentConversions(userId, userId, limit, offset);
    return { count: conversions.length, conversions };
  } catch (err) {
    logger.warn('[openclaw-bridge] affiliate stats failed', toError(err), { userId });
    return { count: 0, conversions: [] };
  }
}
