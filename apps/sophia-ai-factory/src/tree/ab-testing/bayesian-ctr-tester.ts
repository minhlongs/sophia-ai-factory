/**
 * @file bayesian-ctr-tester.ts
 * @description Pure domain engine for Beta-Binomial Bayesian CTR updating & Chi-Square testing
 * @layer tree
 */

import type { AbVariant, AbSignificanceResult } from '@/seed/types/growth-triad-v5-types';

export function calculatePosteriorBeatControl(
  control: AbVariant,
  treatment: AbVariant,
  simulations = 2000
): number {
  const alphaC = 1 + control.clicks;
  const betaC = 1 + (control.impressions - control.clicks);
  const alphaT = 1 + treatment.clicks;
  const betaT = 1 + (treatment.impressions - treatment.clicks);

  let wins = 0;
  for (let i = 0; i < simulations; i++) {
    // Normal approximation for beta posteriors
    const meanC = alphaC / (alphaC + betaC);
    const varC = (alphaC * betaC) / (Math.pow(alphaC + betaC, 2) * (alphaC + betaC + 1));
    const sampleC = meanC + (Math.random() - 0.5) * Math.sqrt(varC) * 3.46;

    const meanT = alphaT / (alphaT + betaT);
    const varT = (alphaT * betaT) / (Math.pow(alphaT * betaT, 2) * (alphaT * betaT + 1));
    const sampleT = meanT + (Math.random() - 0.5) * Math.sqrt(varT) * 3.46;

    if (sampleT > sampleC) {
      wins++;
    }
  }

  return wins / simulations;
}

export function calculateChiSquarePValue(
  control: AbVariant,
  treatment: AbVariant
): number {
  const a = control.clicks;
  const b = Math.max(0, control.impressions - control.clicks);
  const c = treatment.clicks;
  const d = Math.max(0, treatment.impressions - treatment.clicks);

  const n = a + b + c + d;
  if (n === 0) return 1.0;

  // Pearson chi-square with Yates' continuity correction
  const numerator = n * Math.pow(Math.max(0, Math.abs(a * d - b * c) - n / 2), 2);
  const denominator = (a + b) * (c + d) * (a + c) * (b + d);

  if (denominator === 0) return 1.0;
  const chiSquare = numerator / denominator;

  // Approximate 1-degree-of-freedom p-value using standard normal tail
  const z = Math.sqrt(chiSquare);
  // Complementary error function approximation
  const pValue = Math.exp(-0.5 * z * z) / (z * Math.sqrt(2 * Math.PI) + 1e-6);
  return Math.min(1.0, Math.max(0.0, pValue));
}

export function evaluateExperimentSignificance(
  variants: AbVariant[],
  minImpressionsPerVariant = 200,
  confidenceThreshold = 0.95
): AbSignificanceResult {
  const control = variants.find((v) => v.isControl) || variants[0];
  if (!control) {
    return {
      hasSignificantWinner: false,
      posteriorProbabilityBeatControl: 0,
      pvalueChiSquare: 1.0,
      confidenceLevelPct: 0,
    };
  }

  let bestTreatment: AbVariant | undefined;
  let maxProb = 0;
  let minPValue = 1.0;

  for (const v of variants) {
    if (v.id === control.id) continue;
    if (v.impressions < minImpressionsPerVariant || control.impressions < minImpressionsPerVariant) {
      continue;
    }

    const prob = calculatePosteriorBeatControl(control, v);
    const pVal = calculateChiSquarePValue(control, v);

    if (prob > maxProb) {
      maxProb = prob;
      minPValue = pVal;
      bestTreatment = v;
    }
  }

  const isSignificant =
    maxProb >= confidenceThreshold &&
    minPValue <= (1 - confidenceThreshold) &&
    bestTreatment !== undefined;

  return {
    hasSignificantWinner: isSignificant,
    winnerVariantId: isSignificant ? bestTreatment?.id : undefined,
    posteriorProbabilityBeatControl: maxProb,
    pvalueChiSquare: minPValue,
    confidenceLevelPct: Math.round(maxProb * 100),
  };
}
