/**
 * Pure Domain Contracts: Predictive LTV, Churn Scoring & Account Expansion
 *
 * Milestone: GATE 9: $2,500,000 MRR ($30,000,000 ARR, 10,000 Customers, $250 ARPU, Cohort NRR >= 135%)
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module seed/types/predictive-expansion
 */

import type { Tier } from '@/seed/types';

// ── Milestone Constants ─────────────────────────────────────────────────────

export const GATE_9_CONSTANTS = {
  TARGET_MRR_CENTS: 250_000_000, // $2,500,000.00 USD
  TARGET_ARR_CENTS: 3_000_000_000, // $30,000,000.00 USD
  TARGET_CUSTOMERS: 10_000,
  TARGET_ARPU_CENTS: 25_000, // $250.00 USD
  TARGET_NRR_PCT: 135.0, // >= 135.0%
  TARGET_GRR_PCT: 95.0, // >= 95.0%
  MAX_MONTHLY_CHURN_PCT: 1.5, // <= 1.5%
  MONTE_CARLO_ITERATIONS: 10_000,
  ANNUAL_DISCOUNT_RATE_WACC: 0.10, // 10% annual WACC
  MONTHLY_DISCOUNT_RATE: 0.008, // Monthly compounded discount rate (~0.8%)
} as const;

// ── Enums & Const Arrays ────────────────────────────────────────────────────

export const PREDICTIVE_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type PredictiveRiskLevel = (typeof PREDICTIVE_RISK_LEVELS)[number];

export const EXPANSION_STAGES = [
  'nurture',
  'ready',
  'engaged',
  'negotiating',
  'expanded',
  'stalled',
] as const;
export type ExpansionStage = (typeof EXPANSION_STAGES)[number];

export const PREDICTIVE_ACTIONS = [
  'maintain',
  'proactive_retention',
  'quota_expansion',
  'tier_upgrade',
  'enterprise_gpu_lane',
  'custom_contract',
] as const;
export type PredictiveAction = (typeof PREDICTIVE_ACTIONS)[number];

export const EXPANSION_RECOMMENDATION_TYPES = [
  'tier_upgrade',
  'mcu_quota_expansion',
  'dedicated_gpu_lane',
  'custom_enterprise_sla',
] as const;
export type ExpansionRecommendationType = (typeof EXPANSION_RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_STATUSES = [
  'pending',
  'notified',
  'in_review',
  'accepted',
  'automated_applied',
  'declined',
  'expired',
] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const RECOMMENDATION_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

// ── Database Row Interfaces ─────────────────────────────────────────────────

export interface CustomerPredictiveScoreRow {
  id: string;
  customer_id: string;
  org_id: string | null;
  current_tier: Tier;
  tenure_days: number;
  current_mrr_cents: number;
  predicted_mrr_24m_cents: number;
  churn_probability: number;
  forecast_ltv_24m_cents: number;
  expansion_readiness_score: number;
  health_score: number;
  confidence_score: number;
  risk_level: PredictiveRiskLevel;
  expansion_stage: ExpansionStage;
  feature_weights_json: string;
  recommended_action: PredictiveAction;
  evaluated_at: number;
  created_at: number;
  updated_at: number;
}

export interface ExpansionRecommendationRow {
  id: string;
  customer_id: string;
  org_id: string | null;
  score_id: string | null;
  recommendation_type: ExpansionRecommendationType;
  current_tier: Tier;
  target_tier: Tier | null;
  current_mcu_quota: number;
  recommended_mcu_quota: number;
  current_gpu_lanes: number;
  recommended_gpu_lanes: number;
  current_mrr_cents: number;
  projected_expansion_mrr_cents: number;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  confidence_score: number;
  triggers_json: string;
  rationale_vi: string;
  rationale_en: string;
  discount_offer_pct: number;
  applied_at: number | null;
  expires_at: number;
  created_at: number;
  updated_at: number;
}

export interface InvestorRelationsForecastRow {
  id: string;
  forecast_batch_id: string;
  forecast_period_month: string;
  horizon_month_offset: number;
  baseline_mrr_cents: number;
  p10_pessimistic_mrr_cents: number;
  p50_expected_mrr_cents: number;
  p90_optimistic_mrr_cents: number;
  p99_bull_case_mrr_cents: number;
  simulated_iterations: number;
  expected_active_customers: number;
  expected_arpu_cents: number;
  projected_nrr_pct: number;
  projected_grr_pct: number;
  projected_churn_rate_pct: number;
  projected_expansion_rate_pct: number;
  target_mrr_cents: number;
  target_customers: number;
  target_arpu_cents: number;
  probability_achieving_target: number;
  assumptions_json: string;
  is_approved_for_board: number; // 0 | 1
  approved_by: string | null;
  approved_at: number | null;
  created_at: number;
}

// ── Domain Model Interfaces ─────────────────────────────────────────────────

export interface FeatureWeightsBreakdown {
  quotaSaturation: number;
  usageVelocity: number;
  loginCadence: number;
  errorRate: number;
  tenureFactor: number;
  agentFleetActivation: number;
}

export interface CustomerPredictiveScore {
  id: string;
  customerId: string;
  orgId: string | null;
  currentTier: Tier;
  tenureDays: number;
  currentMrrCents: number;
  predictedMrr24mCents: number;
  churnProbability: number; // 0.0 - 1.0
  forecastLtv24mCents: number;
  expansionReadinessScore: number; // 0.0 - 1.0
  healthScore: number; // 0.0 - 1.0
  confidenceScore: number;
  riskLevel: PredictiveRiskLevel;
  expansionStage: ExpansionStage;
  featureWeights: FeatureWeightsBreakdown;
  recommendedAction: PredictiveAction;
  evaluatedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface ExpansionRecommendation {
  id: string;
  customerId: string;
  orgId: string | null;
  scoreId: string | null;
  recommendationType: ExpansionRecommendationType;
  currentTier: Tier;
  targetTier: Tier | null;
  currentMcuQuota: number;
  recommendedMcuQuota: number;
  currentGpuLanes: number;
  recommendedGpuLanes: number;
  currentMrrCents: number;
  projectedExpansionMrrCents: number;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  confidenceScore: number;
  triggers: string[];
  rationaleVi: string;
  rationaleEn: string;
  discountOfferPct: number;
  appliedAt: number | null;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface MonthlyForecastSlice {
  id: string;
  forecastBatchId: string;
  forecastPeriodMonth: string;
  horizonMonthOffset: number; // 1 to 12
  baselineMrrCents: number;
  p10PessimisticMrrCents: number;
  p50ExpectedMrrCents: number;
  p90OptimisticMrrCents: number;
  p99BullCaseMrrCents: number;
  simulatedIterations: number;
  expectedActiveCustomers: number;
  expectedArpuCents: number;
  projectedNrrPct: number;
  projectedGrrPct: number;
  projectedChurnRatePct: number;
  projectedExpansionRatePct: number;
  targetMrrCents: number;
  targetCustomers: number;
  targetArpuCents: number;
  probabilityAchievingTarget: number;
  assumptions: Record<string, unknown>;
  isApprovedForBoard: boolean;
  approvedBy: string | null;
  approvedAt: number | null;
  createdAt: number;
}

export interface InvestorRelationsForecastReport {
  batchId: string;
  generatedAt: number;
  slices: MonthlyForecastSlice[];
  targetAchievedInP50: boolean;
  overallTargetProbability: number;
  summary: {
    startingMrrCents: number;
    endingP50MrrCents: number;
    endingP90MrrCents: number;
    projectedAvgNrrPct: number;
  };
}

// ── Computation Inputs ──────────────────────────────────────────────────────

export interface CustomerTelemetryFeatures {
  customerId: string;
  orgId?: string | null;
  currentTier: Tier;
  tenureDays: number;
  currentMrrCents: number;
  usedMcuMonthly: number;
  quotaMcuMonthly: number;
  videoGenerationsLast7d: number;
  videoGenerationsPrev30d: number;
  activeLoginsLast14d: number;
  apiRequestsCount: number;
  apiErrorsCount: number;
  activeAgentsCount: number;
  featuresUsedCount: number;
}

export interface MonteCarloSimulationInput {
  startingMrrCents: number;
  startingCustomersCount: number;
  iterations?: number; // default: 10,000
  horizonMonths?: number; // default: 12
  meanMonthlyChurnPct?: number; // default: 1.0% (0.010)
  stdDevMonthlyChurnPct?: number; // default: 0.3% (0.003)
  meanMonthlyExpansionPct?: number; // default: 3.5% (0.035)
  stdDevMonthlyExpansionPct?: number; // default: 0.8% (0.008)
  meanMonthlyNewCustomers?: number; // default: 450
  stdDevMonthlyNewCustomers?: number; // default: 50
  newCustomerArpuCents?: number; // default: 22,000 cents ($220)
  batchId?: string;
  randomSeed?: number; // for deterministic testing
}

// ── Action Result Interface ─────────────────────────────────────────────────

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Row Mappers ─────────────────────────────────────────────────────────────

export function mapRowToCustomerPredictiveScore(row: CustomerPredictiveScoreRow): CustomerPredictiveScore {
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

export function mapRowToExpansionRecommendation(row: ExpansionRecommendationRow): ExpansionRecommendation {
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

export function mapRowToMonthlyForecastSlice(row: InvestorRelationsForecastRow): MonthlyForecastSlice {
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
