/**
 * Executive BI Metrics Aggregator Service.
 *
 * Implements persistence and aggregation queries for Executive BI metrics in D1.
 *
 * Layer: tree/bi/aggregator
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  DateRange,
  ExecutiveBIMetricsSummary,
  ExecutiveBIMetricRow,
} from './types';
import {
  createEmptyBIMetricsSummary,
  calculateRoiRatio,
  isValidDateRange,
} from './time-series-rollup';

export {
  recordExecutiveBIMetric,
  recordExecutiveBIMetricsBatch,
} from './metrics-recorder';

/**
 * Aggregates executive BI metrics for a specific organization across a specified date range.
 */
export async function aggregateExecutiveBIMetrics(
  db: D1Database,
  orgId: string,
  dateRange: DateRange,
): Promise<ExecutiveBIMetricsSummary> {
  const sanitizedOrgId = (orgId ?? '').trim();
  if (!sanitizedOrgId || !isValidDateRange(dateRange)) {
    logger.warn('[ExecutiveBIAggregator] Invalid orgId or dateRange provided', { orgId, dateRange });
    return createEmptyBIMetricsSummary(sanitizedOrgId, dateRange ?? { start: 0, end: 0 });
  }

  try {
    const rows = await db
      .prepare(
        `SELECT id, org_id, period_start, period_end, mrr_cents, throughput_count,
         viral_score, affiliate_revenue_cents, marketing_spend_cents, channel, created_at
         FROM executive_bi_metrics
         WHERE org_id = ?1 AND period_start >= ?2 AND period_end <= ?3
         ORDER BY period_start ASC`,
      )
      .bind(sanitizedOrgId, dateRange.start, dateRange.end)
      .all<ExecutiveBIMetricRow>();

    const results = rows.results ?? [];
    if (results.length === 0) {
      return createEmptyBIMetricsSummary(sanitizedOrgId, dateRange);
    }

    let peakMrr = 0, totalThroughput = 0, sumViral = 0, totalAffiliate = 0, totalSpend = 0;
    for (const r of results) {
      const mrr = Number(r.mrr_cents) || 0;
      if (mrr > peakMrr) peakMrr = mrr;
      totalThroughput += Number(r.throughput_count) || 0;
      sumViral += Number(r.viral_score) || 0;
      totalAffiliate += Number(r.affiliate_revenue_cents) || 0;
      totalSpend += Number(r.marketing_spend_cents) || 0;
    }

    const avgViral = Number((sumViral / results.length).toFixed(2));
    const roiRatio = calculateRoiRatio(totalAffiliate, totalSpend);

    return {
      orgId: sanitizedOrgId,
      periodStart: dateRange.start,
      periodEnd: dateRange.end,
      mrrCents: peakMrr,
      throughputCount: totalThroughput,
      viralScore: avgViral,
      affiliateRevenueCents: totalAffiliate,
      marketingSpendCents: totalSpend,
      roiRatio,
    };
  } catch (error) {
    logger.error('[ExecutiveBIAggregator] Query execution failed', { error, orgId: sanitizedOrgId, dateRange });
    throw error;
  }
}
