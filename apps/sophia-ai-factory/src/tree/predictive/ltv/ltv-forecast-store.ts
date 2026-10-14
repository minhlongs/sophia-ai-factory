/**
 * Investor Relations Forecast Batch D1 Persistence
 *
 * Layer: tree/predictive/ltv
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { MonthlyForecastSlice } from '@/seed/types/predictive-expansion';

export async function saveInvestorRelationsForecastBatch(
  db: D1Database,
  slices: MonthlyForecastSlice[]
): Promise<number> {
  let count = 0;
  for (const s of slices) {
    await db
      .prepare(`
        INSERT INTO investor_relations_forecasts (
          id, forecast_batch_id, forecast_period_month, horizon_month_offset,
          baseline_mrr_cents, p10_pessimistic_mrr_cents, p50_expected_mrr_cents,
          p90_optimistic_mrr_cents, p99_bull_case_mrr_cents, simulated_iterations,
          expected_active_customers, expected_arpu_cents, projected_nrr_pct,
          projected_grr_pct, projected_churn_rate_pct, projected_expansion_rate_pct,
          target_mrr_cents, target_customers, target_arpu_cents,
          probability_achieving_target, assumptions_json, is_approved_for_board,
          approved_by, approved_at, created_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `)
      .bind(
        s.id,
        s.forecastBatchId,
        s.forecastPeriodMonth,
        s.horizonMonthOffset,
        s.baselineMrrCents,
        s.p10PessimisticMrrCents,
        s.p50ExpectedMrrCents,
        s.p90OptimisticMrrCents,
        s.p99BullCaseMrrCents,
        s.simulatedIterations,
        s.expectedActiveCustomers,
        s.expectedArpuCents,
        s.projectedNrrPct,
        s.projectedGrrPct,
        s.projectedChurnRatePct,
        s.projectedExpansionRatePct,
        s.targetMrrCents,
        s.targetCustomers,
        s.targetArpuCents,
        s.probabilityAchievingTarget,
        JSON.stringify(s.assumptions),
        s.isApprovedForBoard ? 1 : 0,
        s.approvedBy,
        s.approvedAt,
        s.createdAt
      )
      .run();
    count++;
  }
  return count;
}
