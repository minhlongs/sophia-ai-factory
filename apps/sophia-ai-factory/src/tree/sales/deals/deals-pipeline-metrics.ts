/**
 * Enterprise Deals Pipeline Metrics Aggregator
 *
 * Layer: tree/sales (Pure domain logic - only imports from @/seed)
 *
 * @module tree/sales/deals/deals-pipeline-metrics
 */

import type { D1Database } from '@/seed/db/client';

/**
 * Aggregates high-level enterprise pipeline metrics for dashboard display.
 */
export async function getDealsPipelineMetrics(db: D1Database): Promise<{
  totalDeals: number;
  hotDeals: number;
  warmDeals: number;
  coldDeals: number;
  totalEstimatedValueCents: number;
  avgBantScore: number;
  wonDeals: number;
}> {
  const stats = await db
    .prepare(`
      SELECT
        COUNT(*) as total_deals,
        SUM(CASE WHEN pipeline_tier = 'hot' THEN 1 ELSE 0 END) as hot_deals,
        SUM(CASE WHEN pipeline_tier = 'warm' THEN 1 ELSE 0 END) as warm_deals,
        SUM(CASE WHEN pipeline_tier = 'cold' THEN 1 ELSE 0 END) as cold_deals,
        SUM(deal_value_estimate_cents) as total_val_cents,
        AVG(bant_score) as avg_bant,
        SUM(CASE WHEN deal_stage = 'closed_won' THEN 1 ELSE 0 END) as won_deals
      FROM enterprise_deals
    `)
    .first<{
      total_deals: number;
      hot_deals: number;
      warm_deals: number;
      cold_deals: number;
      total_val_cents: number | null;
      avg_bant: number | null;
      won_deals: number;
    }>();

  return {
    totalDeals: Number(stats?.total_deals || 0),
    hotDeals: Number(stats?.hot_deals || 0),
    warmDeals: Number(stats?.warm_deals || 0),
    coldDeals: Number(stats?.cold_deals || 0),
    totalEstimatedValueCents: Number(stats?.total_val_cents || 0),
    avgBantScore: Math.round(Number(stats?.avg_bant || 0)),
    wonDeals: Number(stats?.won_deals || 0),
  };
}
