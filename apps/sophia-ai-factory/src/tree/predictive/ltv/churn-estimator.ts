/**
 * Pseudo-Random Generator & Churn Hazard Formulation
 *
 * Layer: tree/predictive/ltv
 */

import type {
  CustomerTelemetryFeatures,
  FeatureWeightsBreakdown,
  PredictiveRiskLevel,
} from '@/seed/types/predictive-expansion';

// ── Deterministic LCG Pseudo-Random Number Generator ───────────────────────

export class PseudoRandomGenerator {
  private seed: number;

  constructor(initialSeed = 1337420) {
    this.seed = initialSeed;
  }

  public next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /** Box-Muller transform for normal distribution */
  public nextGaussian(mean = 0, stdDev = 1): number {
    const u1 = Math.max(1e-15, this.next());
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}

// ── Pure Churn Hazard Formulation ──────────────────────────────────────────

export function calculateChurnProbability(features: CustomerTelemetryFeatures): {
  churnProbability: number;
  riskLevel: PredictiveRiskLevel;
  featureWeights: FeatureWeightsBreakdown;
  healthScore: number;
} {
  const quotaSat = features.quotaMcuMonthly > 0
    ? features.usedMcuMonthly / features.quotaMcuMonthly
    : 0;

  const usageVelocity = features.videoGenerationsPrev30d > 0
    ? (features.videoGenerationsLast7d * 4 - features.videoGenerationsPrev30d) / features.videoGenerationsPrev30d
    : 0;

  const loginCadence = Math.min(1.0, Math.max(0.0, features.activeLoginsLast14d / 14));

  const errorRate = features.apiRequestsCount > 0
    ? features.apiErrorsCount / features.apiRequestsCount
    : 0;

  const tenureFactor = Math.min(1.0, Math.max(0.0, features.tenureDays / 180));
  const agentFleetActivation = Math.min(1.0, Math.max(0.0, features.activeAgentsCount / 4));

  // Calibrated logistic regression hazard weights
  const b0 = -2.2;
  const bSat = 1.2 * (1.0 - Math.min(1.0, Math.max(0.0, quotaSat)));
  const bDrop = 1.8 * Math.max(0.0, -usageVelocity);
  const bErr = 2.0 * Math.min(1.0, Math.max(0.0, errorRate * 10));
  const bLogin = 1.5 * (1.0 - loginCadence);
  const bTenure = -0.8 * tenureFactor;
  const bAgent = -0.6 * agentFleetActivation;

  const z = b0 + bSat + bDrop + bErr + bLogin + bTenure + bAgent;
  const rawProb = 1.0 / (1.0 + Math.exp(-z));
  const churnProbability = Number(Math.min(0.999, Math.max(0.001, rawProb)).toFixed(4));

  let riskLevel: PredictiveRiskLevel = 'low';
  if (churnProbability >= 0.70) riskLevel = 'critical';
  else if (churnProbability >= 0.45) riskLevel = 'high';
  else if (churnProbability >= 0.20) riskLevel = 'medium';

  const healthScore = Number(Math.max(0.0, Math.min(1.0, 1.0 - churnProbability)).toFixed(4));

  const featureWeights: FeatureWeightsBreakdown = {
    quotaSaturation: Number(quotaSat.toFixed(4)),
    usageVelocity: Number(usageVelocity.toFixed(4)),
    loginCadence: Number(loginCadence.toFixed(4)),
    errorRate: Number(errorRate.toFixed(4)),
    tenureFactor: Number(tenureFactor.toFixed(4)),
    agentFleetActivation: Number(agentFleetActivation.toFixed(4)),
  };

  return { churnProbability, riskLevel, featureWeights, healthScore };
}
