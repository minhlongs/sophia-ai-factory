/**
 * Usage Rollup Engine
 *
 * Quota limit definitions and database-backed quota checking.
 * Provides aggregated period summaries for reporting.
 *
 * @module usage-metering/usage-rollup-engine
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { aggregateUsageEvents, buildHourlySummary, buildDailySummary } from './usage-event-collector';
import type {
  QuotaCheckResult,
  HourlySummary,
  DailySummary,
} from './types';
import type { D1Response } from '@/seed/db/types';
// Import from seed (canonical home) and re-export for back-compat
import { QUOTA_LIMITS } from '@/seed/config/quota-limits';
export { QUOTA_LIMITS };

/** Maximum date range for queries (90 days) — prevents expensive full-table scans */
const MAX_DATE_RANGE_DAYS = 90;

interface UsageDataRow { credits_used: number; }

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
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  try {
    type QuotaQuery = D1Response<UsageDataRow[]>;
    const [hourlyRes, dailyRes, monthlyRes] = await Promise.all([
      (db.from('usage_events').select('credits_used').eq('user_id', tenantId).eq('license_nonce', licenseNonce).gte('created_at', hourStart).lt('created_at', hourStart + 3600) as unknown as QuotaQuery),
      (db.from('usage_events').select('credits_used').eq('user_id', tenantId).eq('license_nonce', licenseNonce).gte('created_at', dayStart).lt('created_at', dayStart + 86400) as unknown as QuotaQuery),
      (db.from('usage_events').select('credits_used').eq('user_id', tenantId).eq('license_nonce', licenseNonce).gte('created_at', monthStart) as unknown as QuotaQuery),
    ]);

    const sum = (data: UsageDataRow[] | null) =>
      (data || []).reduce((s: number, r: UsageDataRow) => s + (r.credits_used || 0), 0);

    const hourlyCredits = sum(hourlyRes.data as UsageDataRow[]);
    const dailyCredits = sum(dailyRes.data as UsageDataRow[]);
    const monthlyCredits = sum(monthlyRes.data as UsageDataRow[]);
    const dailyRequests = dailyRes.data?.length || 0;

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
    // Fail open — allow request if quota check fails
    return { allowed: true, remaining: { dailyCredits: 0, hourlyCredits: 0, dailyRequests: 0, monthlyCredits: 0 } };
  }
}

/**
 * Get aggregated summary for a tenant by period
 */
export async function getAggregatedSummary(
  tenantId: string,
  startTimestamp: number,
  endTimestamp: number,
  licenseNonce?: string
): Promise<{ hourly: HourlySummary[]; daily: DailySummary[]; totalCredits: number; totalRequests: number }> {
  // Cap date range at 90 days
  const maxRange = MAX_DATE_RANGE_DAYS * 86400;
  let endTs = endTimestamp;
  if (endTs - startTimestamp > maxRange) {
    logger.warn('[Aggregator] Date range exceeds maximum, limiting to 90 days');
    endTs = startTimestamp + maxRange;
  }

  const db = createServerClient();
  let query = db.from('usage_events').select('*').eq('user_id', tenantId).gte('created_at', startTimestamp).lte('created_at', endTs);

  if (licenseNonce) {
    query = query.eq('license_nonce', licenseNonce);
  }

  const { data: events, error } = await query as unknown as D1Response<Record<string, unknown>[]>;

  if (error || !events || events.length === 0) {
    if (error) logger.error('[Aggregator] Failed to fetch events', error instanceof Error ? error : new Error(String(error)));
    return { hourly: [], daily: [], totalCredits: 0, totalRequests: 0 };
  }

  const aggregated = aggregateUsageEvents(events as Array<{
    user_id: string;
    license_nonce: string;
    service_name: string;
    action: string;
    credits_used: number;
    tokens_input: number;
    tokens_output: number;
    response_time_ms: number | null;
    status_code: number | null;
    created_at: number;
  }>, 'hour');
  const hourly = buildHourlySummary(aggregated);
  const daily = buildDailySummary(hourly);

  return {
    hourly,
    daily,
    totalCredits: hourly.reduce((sum, h) => sum + h.totalCredits, 0),
    totalRequests: hourly.reduce((sum, h) => sum + h.totalRequests, 0),
  };
}
