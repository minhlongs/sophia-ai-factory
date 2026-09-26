'use server';

/**
 * Predictive LTV, Churn & Enterprise Expansion Dashboard Server Actions
 *
 * Milestone: GATE 9: $2,500,000 MRR ($30M ARR, 10,000 Customers, $250 ARPU, Cohort NRR >= 135%)
 * Layer: land/predictive (Server Actions - imports only from @/seed and @/tree)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module land/predictive/predictive-dashboard-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ActionResult,
  CustomerPredictiveScore,
  CustomerTelemetryFeatures,
  ExpansionRecommendation,
  InvestorRelationsForecastReport,
  MonteCarloSimulationInput,
} from '@/seed/types/predictive-expansion';
import {
  calculateChurnProbability,
  computeDiscounted24mLtv,
  getLatestCustomerPredictiveScore,
  runMonteCarloIRSimulation,
  saveCustomerPredictiveScore,
  saveInvestorRelationsForecastBatch,
} from '@/tree/predictive/predictive-ltv-engine';
import {
  applyExpansionRecommendation,
  calculateExpansionReadiness,
  evaluateExpansionOpportunity,
  getActiveRecommendationsForCustomer,
  saveExpansionRecommendation,
} from '@/tree/predictive/account-expansion-engine';

/**
 * Fetches or calculates the latest predictive score and 24-month LTV for a customer.
 */
export async function getCustomerPredictiveScoreAction(
  customerId: string
): Promise<ActionResult<CustomerPredictiveScore>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const score = await getLatestCustomerPredictiveScore(db, customerId);
    if (!score) {
      return { success: false, error: 'No predictive score found for customer' };
    }

    return { success: true, data: score };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[predictive-actions] getCustomerPredictiveScoreAction error', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Evaluates telemetry features and updates predictive score and expansion recommendations.
 */
export async function evaluateCustomerPredictiveMetricsAction(
  features: CustomerTelemetryFeatures
): Promise<
  ActionResult<{
    score: CustomerPredictiveScore;
    recommendation: ExpansionRecommendation | null;
  }>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const now = Date.now();
    const churn = calculateChurnProbability(features);
    const expansion = calculateExpansionReadiness(features);
    const ltv = computeDiscounted24mLtv(features.currentMrrCents, churn.churnProbability, expansion.expansionReadinessScore);

    const score: CustomerPredictiveScore = {
      id: `cps_${features.customerId}_${now}`,
      customerId: features.customerId,
      orgId: features.orgId ?? null,
      currentTier: features.currentTier,
      tenureDays: features.tenureDays,
      currentMrrCents: features.currentMrrCents,
      predictedMrr24mCents: ltv.predictedMrr24mCents,
      churnProbability: churn.churnProbability,
      forecastLtv24mCents: ltv.forecastLtv24mCents,
      expansionReadinessScore: expansion.expansionReadinessScore,
      healthScore: churn.healthScore,
      confidenceScore: 0.95,
      riskLevel: churn.riskLevel,
      expansionStage: expansion.expansionStage,
      featureWeights: churn.featureWeights,
      recommendedAction: expansion.recommendedAction,
      evaluatedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await saveCustomerPredictiveScore(db, score);

    const recommendation = evaluateExpansionOpportunity(features, score);
    if (recommendation) {
      await saveExpansionRecommendation(db, recommendation);
    }

    return { success: true, data: { score, recommendation } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[predictive-actions] evaluateCustomerPredictiveMetricsAction error', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Lists pending expansion recommendations for a customer.
 */
export async function getActiveRecommendationsAction(
  customerId: string
): Promise<ActionResult<ExpansionRecommendation[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const recommendations = await getActiveRecommendationsForCustomer(db, customerId);
    return { success: true, data: recommendations };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[predictive-actions] getActiveRecommendationsAction error', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Accepts and applies an expansion recommendation.
 */
export async function applyExpansionRecommendationAction(
  recommendationId: string
): Promise<ActionResult<{ success: boolean; appliedAt: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const result = await applyExpansionRecommendation(db, recommendationId);
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[predictive-actions] applyExpansionRecommendationAction error', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Runs a 10,000-iteration Monte Carlo revenue forecast simulation for Board & Investor Relations.
 */
export async function generateInvestorRelationsForecastAction(
  input: MonteCarloSimulationInput
): Promise<ActionResult<InvestorRelationsForecastReport>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const { slices, report } = runMonteCarloIRSimulation(input);
    await saveInvestorRelationsForecastBatch(db, slices);

    return { success: true, data: report };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[predictive-actions] generateInvestorRelationsForecastAction error', { error: message });
    return { success: false, error: message };
  }
}
