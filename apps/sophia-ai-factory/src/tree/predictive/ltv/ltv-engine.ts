/**
 * Discounted Cash Flow LTV Engine & D1 Persistence
 *
 * Layer: tree/predictive/ltv
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type CustomerPredictiveScore,
  type CustomerPredictiveScoreRow,
  mapRowToCustomerPredictiveScore,
} from '@/seed/types/predictive-expansion';

export { computeDiscounted24mLtv } from './ltv-dcf';
export { saveInvestorRelationsForecastBatch } from './ltv-forecast-store';

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
