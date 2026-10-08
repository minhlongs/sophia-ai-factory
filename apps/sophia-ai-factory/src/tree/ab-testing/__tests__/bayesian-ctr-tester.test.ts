/**
 * @file bayesian-ctr-tester.test.ts
 * @description Zero-mock unit tests for Bayesian CTR Testing & Chi-Square Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePosteriorBeatControl,
  calculateChiSquarePValue,
  evaluateExperimentSignificance,
} from '../bayesian-ctr-tester';
import type { AbVariant } from '@/seed/types/growth-triad-v5-types';

describe('Bayesian CTR Testing Engine', () => {
  const control: AbVariant = {
    id: 'var-a',
    name: 'Control Hook',
    hookText: 'Standard AI workflow tutorial',
    impressions: 1000,
    clicks: 40, // 4.0% CTR
    isControl: true,
    isPromotedWinner: false,
  };

  const treatmentSuperior: AbVariant = {
    id: 'var-b',
    name: 'Curiosity Hook',
    hookText: 'Never make another video without this hook',
    impressions: 1000,
    clicks: 80, // 8.0% CTR (double CTR)
    isControl: false,
    isPromotedWinner: false,
  };

  it('calculates high posterior probability of beating control for superior variant', () => {
    const prob = calculatePosteriorBeatControl(control, treatmentSuperior, 1000);
    expect(prob).toBeGreaterThan(0.95);
  });

  it('calculates significant chi-square p-value for distinct conversion rates', () => {
    const pVal = calculateChiSquarePValue(control, treatmentSuperior);
    expect(pVal).toBeLessThan(0.05);
  });

  it('evaluates and declares significant winner when thresholds are met', () => {
    const res = evaluateExperimentSignificance(
      [control, treatmentSuperior],
      200,
      0.95
    );

    expect(res.hasSignificantWinner).toBe(true);
    expect(res.winnerVariantId).toBe('var-b');
    expect(res.confidenceLevelPct).toBeGreaterThanOrEqual(95);
  });

  it('does not declare winner prematurely before minimum impressions', () => {
    const lowImprTreatment = { ...treatmentSuperior, impressions: 50, clicks: 10 };
    const res = evaluateExperimentSignificance(
      [control, lowImprTreatment],
      200,
      0.95
    );

    expect(res.hasSignificantWinner).toBe(false);
  });
});
