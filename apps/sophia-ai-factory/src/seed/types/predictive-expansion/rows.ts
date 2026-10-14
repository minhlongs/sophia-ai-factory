import type { Tier } from '@/seed/types';
import type {
  ExpansionRecommendationType,
  ExpansionStage,
  PredictiveAction,
  PredictiveRiskLevel,
  RecommendationPriority,
  RecommendationStatus,
} from './constants';

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
  is_approved_for_board: number;
  approved_by: string | null;
  approved_at: number | null;
  created_at: number;
}
