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
  ExecutiveBIMetricRecord,
  CreateExecutiveBIMetricInput,
} from './types';
import {
  createEmptyBIMetricsSummary,
  calculateRoiRatio,
  isValidDateRange,
} from './time-series-rollup';

const INSERT_SQL = `INSERT INTO executive_bi_metrics (
  id, org_id, period_start, period_end, mrr_cents, throughput_count,
  viral_score, affiliate_revenue_cents, marketing_spend_cents, channel, created_at
) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`;

function buildInsertStatement(
  db: D1Database,
  input: CreateExecutiveBIMetricInput,
  fallbackOrgId?: string,
) {
  const targetOrgId = (input.orgId || fallbackOrgId || '').trim();
  if (!targetOrgId) {
    throw new Error('ORGANIZATION_REQUIRED: Valid orgId is required to record BI metrics');
  }
  const id = input.id ?? `bi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const createdAt = input.createdAt ?? Date.now();
  const stmt = db.prepare(INSERT_SQL).bind(
    id, targetOrgId, input.periodStart, input.periodEnd,
    input.mrrCents, input.throughputCount, input.viralScore,
    input.affiliateRevenueCents, input.marketingSpendCents,
    input.channel ?? null, createdAt,
  );
  return { stmt, record: {
    id, orgId: targetOrgId, periodStart: input.periodStart,
    periodEnd: input.periodEnd, mrrCents: input.mrrCents,
    throughputCount: input.throughputCount, viralScore: input.viralScore,
    affiliateRevenueCents: input.affiliateRevenueCents,
    marketingSpendCents: input.marketingSpendCents,
    channel: input.channel ?? null, createdAt,
  } };
}

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

/**
 * Records a single Executive BI metric snapshot into D1.
 */
export async function recordExecutiveBIMetric(
  db: D1Database,
  input: CreateExecutiveBIMetricInput,
): Promise<ExecutiveBIMetricRecord> {
  const { stmt, record } = buildInsertStatement(db, input);
  await stmt.run();
  return record;
}

/**
 * Records multiple Executive BI metric snapshots in an atomic batch.
 */
export async function recordExecutiveBIMetricsBatch(
  db: D1Database,
  orgIdOrInputs: string | CreateExecutiveBIMetricInput[],
  maybeInputs?: CreateExecutiveBIMetricInput[],
): Promise<{ count: number }> {
  const orgId = typeof orgIdOrInputs === 'string' ? orgIdOrInputs.trim() : undefined;
  const inputs = typeof orgIdOrInputs === 'string' ? (maybeInputs ?? []) : (orgIdOrInputs ?? []);
  if (!inputs.length) return { count: 0 };

  const prepared = inputs.map((input) => buildInsertStatement(db, input, orgId).stmt);
  if (typeof db.batch === 'function') {
    const batchRes = await db.batch(prepared as unknown as Parameters<D1Database['batch']>[0]);
    if (Array.isArray(batchRes) && batchRes.length > 0 && typeof (batchRes[0] as { run?: unknown })?.run === 'function') {
      for (const s of (batchRes as unknown as Array<{ run: () => Promise<unknown> }>)) {
        await s.run();
      }
    }
  } else {
    for (const s of prepared) await s.run();
  }
  return { count: inputs.length };
}
