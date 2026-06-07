/**
 * Usage Rollup Engine
 *
 * Quota limit definitions and database-backed quota checking.
 * Provides aggregated period summaries for reporting.
 *
 * @module usage-metering/usage-rollup-engine
 */

import { createServerClient, getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { aggregateUsageEvents, buildHourlySummary, buildDailySummary } from './usage-event-collector';
import type {
  QuotaCheckResult,
  HourlySummary,
  DailySummary,
  CreditSlotReservation,
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
  const monthStart = Math.floor(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).getTime() / 1000);

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

// ---------------------------------------------------------------------------
// Atomic credit reservation (fixes TOCTOU race in checkQuota + trackUsage)
// ---------------------------------------------------------------------------

function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

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
  const d1 = await getD1Raw();

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
