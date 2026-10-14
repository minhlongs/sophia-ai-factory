/**
 * Customer Usage Accounting & Transparency.
 * Aggregates live billing cycle consumption per authenticated tenant with full plan transparency.
 *
 * @module land/billing/customer-usage-summary
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resolveCustomerPlan, calculateOverageAndRemaining } from './customer-usage-plan';
import type {
  CustomerUsageReport,
  DailyUsageBreakdown,
} from './customer-usage-types';
import {
  processUsageRow,
  ingestCompletedVideos,
  buildProviderUsageBreakdown,
  type RawUsageRow,
} from './customer-usage-row-processor';

export * from './customer-usage-types';

function getBillingRange(start?: Date, end?: Date) {
  const now = new Date();
  const s = start ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const e = end ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return {
    startMs: Math.floor(s.getTime()),
    endMs: Math.floor(e.getTime()),
    startIso: s.toISOString(),
    endIso: e.toISOString(),
  };
}

export async function getCustomerUsageSummary(
  userId: string,
  from?: Date,
  to?: Date,
): Promise<CustomerUsageReport> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('TENANT_ID_REQUIRED: Missing user_id for usage summary');
  }

  const { startMs, endMs, startIso, endIso } = getBillingRange(from, to);
  const dailyMap: Record<string, DailyUsageBreakdown> = {};
  const seenEventKeys = new Set<string>();
  const seenVideoIds = new Set<string>();

  const totals = { videoMinutes: 0, elevenLabsChars: 0, falAiImages: 0, openRouterTokens: 0, totalCredits: 0 };

  const getOrCreateDay = (d: string): DailyUsageBreakdown => {
    if (!dailyMap[d]) {
      dailyMap[d] = { date: d, videoMinutes: 0, elevenLabsChars: 0, falAiImages: 0, openRouterTokens: 0, creditsUsed: 0 };
    }
    return dailyMap[d];
  };

  try {
    const db = createServerClient();
    const startSec = Math.floor(startMs / 1000);
    const endSec = Math.floor(endMs / 1000);

    // 1. Query usage_events with strict tenant isolation, non-error status, and deduplication
    const usageRes = await db.prepare(
      `SELECT id, service_name, tokens_input, tokens_output, credits_used, created_at, status_code, idempotency_key, request_id
       FROM usage_events
       WHERE user_id = ?1
         AND created_at >= ?2
         AND created_at <= ?3
         AND (status_code IS NULL OR (status_code >= 200 AND status_code < 300))`,
    ).bind(userId, startSec, endSec).all<RawUsageRow>();

    for (const row of usageRes.results ?? []) {
      processUsageRow(row, seenEventKeys, getOrCreateDay, totals, startSec);
    }

    // 2. Query completed video jobs/generations strictly for user_id (idempotent, no failed/retried/cancelled)
    await ingestCompletedVideos(db, userId, startMs, endMs, startSec, seenVideoIds, getOrCreateDay, totals);
  } catch (err) {
    logger.warn('[CustomerUsageSummary] Partial query degradation', { userId, error: toError(err).message });
  }

  // 3. Resolve plan, limits, overage, and next billing event
  const { plan, limit, nextBillingEvent } = await resolveCustomerPlan(userId, endIso);
  const { percentUsed, remaining, overage } = calculateOverageAndRemaining(totals.totalCredits, limit.mcuMonthly);
  const providers = buildProviderUsageBreakdown(totals);

  return {
    userId,
    billingPeriod: { start: startIso, end: endIso },
    plan,
    limit,
    usage: { ...totals, mcuUsed: totals.totalCredits, percentUsed },
    remaining,
    overage,
    nextBillingEvent,
    totals,
    providers,
    dailyUsage: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
