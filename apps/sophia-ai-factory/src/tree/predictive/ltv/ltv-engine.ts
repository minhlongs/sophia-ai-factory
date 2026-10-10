/**
 * Discounted Cash Flow LTV Engine & D1 Persistence
 *
 * Layer: tree/predictive/ltv
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type CustomerPredictiveScore,
  type CustomerPredictiveScoreRow,
  type MonthlyForecastSlice,
  GATE_9_CONSTANTS,
  mapRowToCustomerPredictiveScore,
} from '@/seed/types/predictive-expansion';

// ── 24-Month Discounted Cash Flow LTV Algorithm ────────────────────────────

export function computeDiscounted24mLtv(
  currentMrrCents: number,
  churnProbability: number,
  expansionReadinessScore: number
): {
  forecastLtv24mCents: number;
  predictedMrr24mCents: number;
} {
  const mrr = Math.max(0, Math.round(currentMrrCents));
  const monthlyExpansionRate = Math.max(-0.02, Math.min(0.08, (expansionReadinessScore - 0.40) * 0.05));
  const monthlyDiscount = GATE_9_CONSTANTS.MONTHLY_DISCOUNT_RATE;

  let totalLtvCents = 0;
  let runningMrr = mrr;

  for (let month = 1; month <= 24; month++) {
    // Survival probability at month t
    const survivalRate = Math.pow(1.0 - churnProbability, month);
    // Discount factor at month t: (1 + d)^-t
    const discountFactor = Math.pow(1.0 + monthlyDiscount, -month);
    // Compound expected MRR
    runningMrr = runningMrr * (1.0 + monthlyExpansionRate);
    // Discounted cash flow
    const dcf = runningMrr * survivalRate * discountFactor;
    totalLtvCents += dcf;
  }

  const resultLtv = Math.max(0, Math.round(totalLtvCents));
  const resultMrr = Math.max(0, Math.round(runningMrr));

  return {
    forecastLtv24mCents: Number.isFinite(resultLtv) ? resultLtv : 0,
    predictedMrr24mCents: Number.isFinite(resultMrr) ? resultMrr : 0,
  };
}

// ── D1 Persistence Operations ───────────────────────────────────────────────

export async function saveCustomerPredictiveScore(
  db: D1Database,
  score: CustomerPredictiveScore
): Promise<CustomerPredictiveScore> {
  const stmt = db.prepare(`
    INSERT INTO customer_predictive_scores (
      id, customer_id, org_id, current_tier, tenure_days,
      current_mrr_cents, predicted_mrr_24m_cents, churn_probability,
      forecast_ltv_24m_cents, expansion_readiness_score, health_score,
      confidence_score, risk_level, expansion_stage, feature_weights_json,
      recommended_action, evaluated_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      predicted_mrr_24m_cents = excluded.predicted_mrr_24m_cents,
      churn_probability = excluded.churn_probability,
      forecast_ltv_24m_cents = excluded.forecast_ltv_24m_cents,
      expansion_readiness_score = excluded.expansion_readiness_score,
      health_score = excluded.health_score,
      risk_level = excluded.risk_level,
      expansion_stage = excluded.expansion_stage,
      feature_weights_json = excluded.feature_weights_json,
      recommended_action = excluded.recommended_action,
      updated_at = excluded.updated_at
  `);

  await stmt
    .bind(
      score.id,
      score.customerId,
      score.orgId,
      score.currentTier,
      score.tenureDays,
      score.currentMrrCents,
      score.predictedMrr24mCents,
      score.churnProbability,
      score.forecastLtv24mCents,
      score.expansionReadinessScore,
      score.healthScore,
      score.confidenceScore,
      score.riskLevel,
      score.expansionStage,
      JSON.stringify(score.featureWeights),
      score.recommendedAction,
      score.evaluatedAt,
      score.createdAt,
      score.updatedAt
    )
    .run();

  return score;
}

export async function getLatestCustomerPredictiveScore(
  db: D1Database,
  customerId: string
): Promise<CustomerPredictiveScore | null> {
  const row = await db
    .prepare('SELECT * FROM customer_predictive_scores WHERE customer_id = ? ORDER BY evaluated_at DESC LIMIT 1')
    .bind(customerId)
    .first<CustomerPredictiveScoreRow>();

  return row ? mapRowToCustomerPredictiveScore(row) : null;
}

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
