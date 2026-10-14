'use server';

/**
 * Score Evaluator Action for Predictive Dashboard
 *
 * @module land/predictive/dashboard/score-evaluator
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ActionResult,
  CustomerPredictiveScore,
  CustomerTelemetryFeatures,
  ExpansionRecommendation,
} from '@/seed/types/predictive-expansion';
import {
  calculateChurnProbability,
  computeDiscounted24mLtv,
  saveCustomerPredictiveScore,
} from '@/tree/predictive/predictive-ltv-engine';
import {
  calculateExpansionReadiness,
  evaluateExpansionOpportunity,
  saveExpansionRecommendation,
} from '@/tree/predictive/account-expansion-engine';

export async function evaluateCustomerPredictiveMetricsAction(
  features: CustomerTelemetryFeatures,
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
    const ltv = computeDiscounted24mLtv(
      features.currentMrrCents,
      churn.churnProbability,
      expansion.expansionReadinessScore,
    );

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
    logger.error(
      '[predictive-actions] evaluateCustomerPredictiveMetricsAction error',
      { error: message },
    );
    return { success: false, error: message };
  }
}
