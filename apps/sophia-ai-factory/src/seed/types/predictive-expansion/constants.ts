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
