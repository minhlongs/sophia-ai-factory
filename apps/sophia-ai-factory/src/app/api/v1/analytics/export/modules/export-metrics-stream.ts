import type { D1Database } from '@/seed/db/client';

export async function* fetchExecutiveBIMetricsStream(
  db: D1Database,
  orgId: string,
  startTimestamp: number,
  endTimestamp: number,
  category?: string,
): AsyncGenerator<Record<string, unknown>> {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  if (category === 'summary') {
    const query = `
      SELECT
        org_id,
        MAX(mrr_cents) AS peak_mrr_cents,
        SUM(throughput_count) AS total_throughput,
        AVG(viral_score) AS avg_viral_score,
        SUM(affiliate_revenue_cents) AS total_affiliate_cents,
        SUM(marketing_spend_cents) AS total_spend_cents,
        COUNT(*) AS row_count
      FROM executive_bi_metrics
      WHERE org_id = ?1 AND period_start >= ?2 AND period_end <= ?3
      GROUP BY org_id
    `;
    const res = await db.prepare(query).bind(orgId, startTimestamp, endTimestamp).first<{
      org_id: string;
      peak_mrr_cents: number;
      total_throughput: number;
      avg_viral_score: number;
      total_affiliate_cents: number;
      total_spend_cents: number;
      row_count: number;
    }>();

    if (res && res.row_count > 0) {
      const spend = res.total_spend_cents ?? 0;
      const aff = res.total_affiliate_cents ?? 0;
      const roiRatio = spend > 0 ? Number((aff / spend).toFixed(2)) : aff > 0 ? 99.0 : 0;

      yield {
        org_id: res.org_id,
        period_start: new Date(startTimestamp).toISOString(),
        period_end: new Date(endTimestamp).toISOString(),
        peak_mrr_usd: ((res.peak_mrr_cents ?? 0) / 100).toFixed(2),
        total_throughput: res.total_throughput ?? 0,
        average_viral_score: Number((res.avg_viral_score ?? 0).toFixed(2)),
        total_affiliate_revenue_usd: (aff / 100).toFixed(2),
        total_marketing_spend_usd: (spend / 100).toFixed(2),
        roi_multiplier: `${roiRatio}x`,
        record_count: res.row_count,
      };
    }
    return;
  }

  while (hasMore) {
    const query = `
      SELECT id, org_id, period_start, period_end, mrr_cents, throughput_count,
             viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at
      FROM executive_bi_metrics
      WHERE org_id = ?1 AND period_start >= ?2 AND period_end <= ?3
      ORDER BY period_start ASC
      LIMIT ?4 OFFSET ?5
    `;
    const batch = await db.prepare(query)
      .bind(orgId, startTimestamp, endTimestamp, PAGE_SIZE, offset)
      .all<{
        id: string;
        org_id: string;
        period_start: number;
        period_end: number;
        mrr_cents: number;
        throughput_count: number;
        viral_score: number;
        affiliate_revenue_cents: number;
        marketing_spend_cents: number;
        created_at: number;
      }>();

    const results = batch.results ?? [];
    if (results.length === 0) {
      break;
    }

    for (const row of results) {
      const spend = row.marketing_spend_cents ?? 0;
      const aff = row.affiliate_revenue_cents ?? 0;
      const roi = spend > 0 ? Number((aff / spend).toFixed(2)) : aff > 0 ? 99.0 : 0;

      yield {
        id: row.id,
        org_id: row.org_id,
        period_start: new Date(row.period_start).toISOString(),
        period_end: new Date(row.period_end).toISOString(),
        mrr_usd: (row.mrr_cents / 100).toFixed(2),
        throughput: row.throughput_count,
        viral_score: row.viral_score,
        affiliate_revenue_usd: (aff / 100).toFixed(2),
        marketing_spend_usd: (spend / 100).toFixed(2),
        roi: `${roi}x`,
        created_at: new Date(row.created_at).toISOString(),
      };
    }

    offset += results.length;
    if (results.length < PAGE_SIZE) {
      hasMore = false;
    }
  }
}
