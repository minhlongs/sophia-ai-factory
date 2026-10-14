import type {
  CustomerPredictiveScoreRow,
  ExpansionRecommendationRow,
  InvestorRelationsForecastRow,
} from './rows';
import type {
  CustomerPredictiveScore,
  ExpansionRecommendation,
  FeatureWeightsBreakdown,
  MonthlyForecastSlice,
} from './models';

export function mapRowToCustomerPredictiveScore(
  row: CustomerPredictiveScoreRow
): CustomerPredictiveScore {
  let featureWeights: FeatureWeightsBreakdown = {
    quotaSaturation: 0,
    usageVelocity: 0,
    loginCadence: 0,
    errorRate: 0,
    tenureFactor: 0,
    agentFleetActivation: 0,
  };
  try {
    featureWeights = { ...featureWeights, ...JSON.parse(row.feature_weights_json || '{}') };
  } catch {
    // fallback
  }

  return {
    id: row.id,
    customerId: row.customer_id,
    orgId: row.org_id,
    currentTier: row.current_tier,
    tenureDays: Number(row.tenure_days),
    currentMrrCents: Number(row.current_mrr_cents),
    predictedMrr24mCents: Number(row.predicted_mrr_24m_cents),
    churnProbability: Number(row.churn_probability),
    forecastLtv24mCents: Number(row.forecast_ltv_24m_cents),
    expansionReadinessScore: Number(row.expansion_readiness_score),
    healthScore: Number(row.health_score),
    confidenceScore: Number(row.confidence_score),
    riskLevel: row.risk_level,
    expansionStage: row.expansion_stage,
    featureWeights,
    recommendedAction: row.recommended_action,
    evaluatedAt: Number(row.evaluated_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function mapRowToExpansionRecommendation(
  row: ExpansionRecommendationRow
): ExpansionRecommendation {
  let triggers: string[] = [];
  try {
    triggers = JSON.parse(row.triggers_json || '[]');
  } catch {
    // fallback
  }

  return {
    id: row.id,
    customerId: row.customer_id,
    orgId: row.org_id,
    scoreId: row.score_id,
    recommendationType: row.recommendation_type,
    currentTier: row.current_tier,
    targetTier: row.target_tier,
    currentMcuQuota: Number(row.current_mcu_quota),
    recommendedMcuQuota: Number(row.recommended_mcu_quota),
    currentGpuLanes: Number(row.current_gpu_lanes),
    recommendedGpuLanes: Number(row.recommended_gpu_lanes),
    currentMrrCents: Number(row.current_mrr_cents),
    projectedExpansionMrrCents: Number(row.projected_expansion_mrr_cents),
    priority: row.priority,
    status: row.status,
    confidenceScore: Number(row.confidence_score),
    triggers,
    rationaleVi: row.rationale_vi,
    rationaleEn: row.rationale_en,
    discountOfferPct: Number(row.discount_offer_pct),
    appliedAt: row.applied_at ? Number(row.applied_at) : null,
    expiresAt: Number(row.expires_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function mapRowToMonthlyForecastSlice(
  row: InvestorRelationsForecastRow
): MonthlyForecastSlice {
  let assumptions: Record<string, unknown> = {};
  try {
    assumptions = JSON.parse(row.assumptions_json || '{}');
  } catch {
    // fallback
  }

  return {
    id: row.id,
    forecastBatchId: row.forecast_batch_id,
    forecastPeriodMonth: row.forecast_period_month,
    horizonMonthOffset: Number(row.horizon_month_offset),
    baselineMrrCents: Number(row.baseline_mrr_cents),
    p10PessimisticMrrCents: Number(row.p10_pessimistic_mrr_cents),
    p50ExpectedMrrCents: Number(row.p50_expected_mrr_cents),
    p90OptimisticMrrCents: Number(row.p90_optimistic_mrr_cents),
    p99BullCaseMrrCents: Number(row.p99_bull_case_mrr_cents),
    simulatedIterations: Number(row.simulated_iterations),
    expectedActiveCustomers: Number(row.expected_active_customers),
    expectedArpuCents: Number(row.expected_arpu_cents),
    projectedNrrPct: Number(row.projected_nrr_pct),
    projectedGrrPct: Number(row.projected_grr_pct),
    projectedChurnRatePct: Number(row.projected_churn_rate_pct),
    projectedExpansionRatePct: Number(row.projected_expansion_rate_pct),
    targetMrrCents: Number(row.target_mrr_cents),
    targetCustomers: Number(row.target_customers),
    targetArpuCents: Number(row.target_arpu_cents),
    probabilityAchievingTarget: Number(row.probability_achieving_target),
    assumptions,
    isApprovedForBoard: Boolean(row.is_approved_for_board),
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? Number(row.approved_at) : null,
    createdAt: Number(row.created_at),
  };
}
