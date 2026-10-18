/**
 * Executive BI Metrics Recorder — D1 insertion and batch persistence.
 *
 * Layer: tree/bi/aggregator
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ExecutiveBIMetricRecord,
  CreateExecutiveBIMetricInput,
} from './types';

const INSERT_SQL = `INSERT INTO executive_bi_metrics (
  id, org_id, period_start, period_end, mrr_cents, throughput_count,
  viral_score, affiliate_revenue_cents, marketing_spend_cents, channel, created_at
) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`;

export function buildInsertStatement(
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
  return {
    stmt,
    record: {
      id, orgId: targetOrgId, periodStart: input.periodStart,
      periodEnd: input.periodEnd, mrrCents: input.mrrCents,
      throughputCount: input.throughputCount, viralScore: input.viralScore,
      affiliateRevenueCents: input.affiliateRevenueCents,
      marketingSpendCents: input.marketingSpendCents,
      channel: input.channel ?? null, createdAt,
    },
  };
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
