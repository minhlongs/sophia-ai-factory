/**
 * Pure 4-Factor Churn Risk Calculator & Customer Health Evaluation
 *
 * @module tree/swarm/retention-flywheel/metrics-calculator
 */

import type {
  CustomerHealthMetric,
  CustomerHealthTelemetryInput,
  HealthTier,
  TrendDirection,
} from '@/seed/types/autonomous-swarm';
import {
  evaluateAgentPenalty,
  evaluateVideoPenalty,
  evaluateApiPenalty,
  evaluateRecencyPenalty,
  resolveHealthTier,
  resolveTrendDirection,
} from './penalty-evaluators';

export {
  evaluateAgentPenalty,
  evaluateVideoPenalty,
  evaluateApiPenalty,
  evaluateRecencyPenalty,
  resolveHealthTier,
  resolveTrendDirection,
};

/**
 * Pure 4-factor churn score calculator.
 * Returns { churnRiskScore, healthTier, riskFactors, trendDirection }.
 */
export function calculateChurnRisk(telemetry: CustomerHealthTelemetryInput): {
  churnRiskScore: number;
  healthTier: HealthTier;
  riskFactors: string[];
  trendDirection: TrendDirection;
} {
  const riskFactors: string[] = [];

  const agentPenalty = evaluateAgentPenalty(telemetry.activeAgentsCount, riskFactors);
  const videoPenalty = evaluateVideoPenalty(telemetry.videoGenerationCount, riskFactors);
  const apiPenalty = evaluateApiPenalty(telemetry.apiRequestCount, telemetry.apiErrorCount, riskFactors);
  const recencyPenalty = evaluateRecencyPenalty(telemetry.loginFrequency7d, riskFactors);

  const rawScore = agentPenalty + videoPenalty + apiPenalty + recencyPenalty;
  const churnRiskScore = Number(Math.min(1.0, Math.max(0.0, rawScore)).toFixed(4));
  const healthTier = resolveHealthTier(churnRiskScore);
  const trendDirection = resolveTrendDirection(churnRiskScore, telemetry.previousChurnRiskScore);

  return {
    churnRiskScore,
    healthTier,
    riskFactors,
    trendDirection,
  };
}

/**
 * Pure function: Evaluates full health metric for a given customer telemetry input.
 */
export function evaluateCustomerHealth(
  telemetry: CustomerHealthTelemetryInput,
  now: number = Date.now()
): CustomerHealthMetric {
  const { churnRiskScore, healthTier, riskFactors, trendDirection } = calculateChurnRisk(telemetry);
  const errorRate = telemetry.apiRequestCount > 0
    ? Number((telemetry.apiErrorCount / telemetry.apiRequestCount).toFixed(4))
    : 0.0;

  const metricId = `chm_${telemetry.customerId}_${now}_${Math.random().toString(16).slice(2, 8)}`;

  return {
    id: metricId,
    customerId: telemetry.customerId,
    orgId: telemetry.orgId ?? null,
    periodStart: now - 30 * 24 * 60 * 60 * 1000,
    periodEnd: now,
    activeAgentsCount: telemetry.activeAgentsCount,
    videoGenerationCount: telemetry.videoGenerationCount,
    apiRequestCount: telemetry.apiRequestCount,
    apiErrorCount: telemetry.apiErrorCount,
    apiErrorRate: errorRate,
    loginFrequency7d: telemetry.loginFrequency7d,
    mcuConsumptionRate: telemetry.mcuConsumptionRate,
    npsScore: telemetry.npsScore ?? null,
    churnRiskScore,
    healthTier,
    trendDirection,
    riskFactors,
    lastActivityAt: telemetry.lastActivityAt ?? now,
    evaluatedAt: now,
    createdAt: now,
  };
}
