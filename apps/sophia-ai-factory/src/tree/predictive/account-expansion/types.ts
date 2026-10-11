/**
 * Account Expansion Engine Types & Constants
 *
 * Milestone: GATE 9: $2,500,000 MRR ($30M ARR, 10,000 Customers, $250 ARPU, Cohort NRR >= 135%)
 * Layer: tree/predictive (Pure domain types & constants)
 *
 * @module tree/predictive/account-expansion/types
 */

export const RECOMMENDATION_EXPIRATION_DAYS = 30;

export type {
  CustomerPredictiveScore,
  CustomerTelemetryFeatures,
  ExpansionRecommendation,
  ExpansionRecommendationRow,
  ExpansionStage,
  PredictiveAction,
  RecommendationPriority,
} from '@/seed/types/predictive-expansion';

export {
  mapRowToExpansionRecommendation,
} from '@/seed/types/predictive-expansion';
