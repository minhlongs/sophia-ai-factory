import type { Tier } from '@/seed/types';
import type {
  ExpansionRecommendationType,
  ExpansionStage,
  PredictiveAction,
  PredictiveRiskLevel,
  RecommendationPriority,
  RecommendationStatus,
} from './constants';

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

export type {
  ActionResult,
  CustomerTelemetryFeatures,
  InvestorRelationsForecastReport,
  MonteCarloSimulationInput,
  MonthlyForecastSlice,
} from './forecast-models';
