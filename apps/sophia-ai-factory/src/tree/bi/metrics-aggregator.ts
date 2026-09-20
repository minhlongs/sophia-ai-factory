/**
 * Executive Business Intelligence (BI) Metrics Aggregator Service
 *
 * Implements core analytical aggregations across multi-track generation runs:
 * - Peak MRR tracking
 * - Total video throughput calculation
 * - Average viral engagement score calculation
 * - Affiliate conversion revenue & marketing spend sums
 * - Return on Investment (ROI) ratio with zero-division protection
 * - Strict multi-tenant data isolation and date range filtering
 *
 * Layer: tree/bi (Pure domain logic — imports only from @/seed)
 *
 * @module tree/bi/metrics-aggregator
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  DateRange,
  ExecutiveBIMetricsSummary,
  ExecutiveBIMetricRow,
  ExecutiveBIMetricRecord,
  CreateExecutiveBIMetricInput,
} from '@/seed/types/executive-bi';

/**
 * Creates an empty, zero-initialized ExecutiveBIMetricsSummary.
 */
export function createEmptyBIMetricsSummary(
  orgId: string,
  dateRange: DateRange,
): ExecutiveBIMetricsSummary {
  return {
    orgId,
    periodStart: dateRange?.start ?? 0,
    periodEnd: dateRange?.end ?? 0,
    mrrCents: 0,
    throughputCount: 0,
    viralScore: 0,
    affiliateRevenueCents: 0,
    marketingSpendCents: 0,
    roiRatio: 0,
  };
}

/**
 * Computes ROI ratio with zero-division protection.
 * - When spend > 0: returns (revenue / spend) rounded to 2 decimal places.
 * - When spend == 0 and revenue > 0: returns safe maximum multiplier 99.0x.
 * - When spend == 0 and revenue == 0: returns 0.0x.
 */
export function calculateRoiRatio(
  affiliateRevenueCents: number,
  marketingSpendCents: number,
): number {
  if (marketingSpendCents > 0) {
    return Number((affiliateRevenueCents / marketingSpendCents).toFixed(2));
  }
  if (affiliateRevenueCents > 0) {
    return 99.0;
  }
  return 0;
}

/**
 * Computes arithmetic mean of viral scores rounded to 2 decimal places.
 */
export function calculateAverageViralScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Number((sum / scores.length).toFixed(2));
}

/**
 * Validates date range integrity.
 */
export function isValidDateRange(range: DateRange): boolean {
  return (
    typeof range === 'object' &&
    range !== null &&
    typeof range.start === 'number' &&
    typeof range.end === 'number' &&
    Number.isFinite(range.start) &&
    Number.isFinite(range.end) &&
    range.start <= range.end
  );
}

/**
 * Aggregates executive BI metrics for a specific organization across a specified date range.
 *
 * @param db - Cloudflare D1 database handle
 * @param orgId - Target organization ID (strict tenant isolation)
 * @param dateRange - Inclusive start and end epoch timestamps
 * @returns Unified ExecutiveBIMetricsSummary
 */
export async function aggregateExecutiveBIMetrics(
  db: D1Database,
  orgId: string,
  dateRange: DateRange,
): Promise<ExecutiveBIMetricsSummary> {
  const sanitizedOrgId = (orgId ?? '').trim();
  if (!sanitizedOrgId || !isValidDateRange(dateRange)) {
    logger.warn('[ExecutiveBIAggregator] Invalid orgId or dateRange provided', {
      orgId,
      dateRange,
    });
    return createEmptyBIMetricsSummary(sanitizedOrgId, dateRange ?? { start: 0, end: 0 });
  }

  try {
    const rows = await db
      .prepare(
        `SELECT
           id,
           org_id,
           period_start,
           period_end,
           mrr_cents,
           throughput_count,
           viral_score,
           affiliate_revenue_cents,
           marketing_spend_cents,
           channel,
           created_at
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

    let peakMrr = 0;
    let totalThroughput = 0;
    let sumViral = 0;
    let totalAffiliate = 0;
    let totalSpend = 0;

    for (const r of results) {
      const mrr = Number(r.mrr_cents) || 0;
      if (mrr > peakMrr) {
        peakMrr = mrr;
      }
      totalThroughput += Number(r.throughput_count) || 0;
      sumViral += Number(r.viral_score) || 0;
      totalAffiliate += Number(r.affiliate_revenue_cents) || 0;
      totalSpend += Number(r.marketing_spend_cents) || 0;
    }

    const avgViral = results.length > 0 ? Number((sumViral / results.length).toFixed(2)) : 0;
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
    logger.error('[ExecutiveBIAggregator] Query execution failed', {
      error,
      orgId: sanitizedOrgId,
      dateRange,
    });
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
  const sanitizedOrgId = (input.orgId ?? '').trim();
  if (!sanitizedOrgId) {
    throw new Error('ORGANIZATION_REQUIRED: Valid orgId is required to record BI metrics');
  }

  const id = input.id ?? `bi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const createdAt = input.createdAt ?? Date.now();

  await db
    .prepare(
      `INSERT INTO executive_bi_metrics (
         id,
         org_id,
         period_start,
         period_end,
         mrr_cents,
         throughput_count,
         viral_score,
         affiliate_revenue_cents,
         marketing_spend_cents,
         channel,
         created_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
    .bind(
      id,
      sanitizedOrgId,
      input.periodStart,
      input.periodEnd,
      input.mrrCents,
      input.throughputCount,
      input.viralScore,
      input.affiliateRevenueCents,
      input.marketingSpendCents,
      input.channel ?? null,
      createdAt,
    )
    .run();

  return {
    id,
    orgId: sanitizedOrgId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    mrrCents: input.mrrCents,
    throughputCount: input.throughputCount,
    viralScore: input.viralScore,
    affiliateRevenueCents: input.affiliateRevenueCents,
    marketingSpendCents: input.marketingSpendCents,
    channel: input.channel ?? null,
    createdAt,
  };
}

/**
 * Records multiple Executive BI metric snapshots in an atomic batch.
 * Supports both signatures:
 * - recordExecutiveBIMetricsBatch(db, inputs)
 * - recordExecutiveBIMetricsBatch(db, orgId, inputs)
 */
export async function recordExecutiveBIMetricsBatch(
  db: D1Database,
  orgIdOrInputs: string | CreateExecutiveBIMetricInput[],
  maybeInputs?: CreateExecutiveBIMetricInput[],
): Promise<{ count: number }> {
  let orgId: string | undefined;
  let inputs: CreateExecutiveBIMetricInput[];

  if (typeof orgIdOrInputs === 'string') {
    orgId = orgIdOrInputs.trim();
    inputs = maybeInputs ?? [];
  } else {
    inputs = orgIdOrInputs ?? [];
  }

  if (!inputs || inputs.length === 0) {
    return { count: 0 };
  }

  const statements = inputs.map((input) => {
    const targetOrgId = (input.orgId || orgId || '').trim();
    if (!targetOrgId) {
      throw new Error('ORGANIZATION_REQUIRED: Valid orgId is required for batch items');
    }
    const id = input.id ?? `bi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const createdAt = input.createdAt ?? Date.now();

    return db
      .prepare(
        `INSERT INTO executive_bi_metrics (
           id,
           org_id,
           period_start,
           period_end,
           mrr_cents,
           throughput_count,
           viral_score,
           affiliate_revenue_cents,
           marketing_spend_cents,
           channel,
           created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        id,
        targetOrgId,
        input.periodStart,
        input.periodEnd,
        input.mrrCents,
        input.throughputCount,
        input.viralScore,
        input.affiliateRevenueCents,
        input.marketingSpendCents,
        input.channel ?? null,
        createdAt,
      );
  });

  if (typeof db.batch === 'function') {
    const batchRes = await db.batch(statements as unknown as Parameters<D1Database['batch']>[0]);
    if (Array.isArray(batchRes) && batchRes.length > 0 && typeof (batchRes[0] as { run?: unknown })?.run === 'function') {
      for (const s of (batchRes as unknown as Array<{ run: () => Promise<unknown> }>)) {
        await s.run();
      }
    }
  } else {
    for (const s of statements) {
      await s.run();
    }
  }
  return { count: inputs.length };
}
