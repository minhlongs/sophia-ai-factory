/**
 * A/B Test Statistical Engine Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeABTest,
  frequentistTest,
  bayesianTest,
  estimateSampleSize,
  checkSampleSufficiency,
  multivariateTest,
  calculateConversionRate,
  calculateStandardError,
  zScoreFromPValue,
  pValueFromZScore,
  probabilityBEatsA,
  Z_SCORES,
  BAYES_THRESHOLDS,
  SAMPLE_DATA,
  type VariantData,
  type SampleSizeConfig,
} from './ab-test-engine';

describe('calculateConversionRate', () => {
  it('should calculate conversion rate correctly', () => {
    const variant: VariantData = { name: 'A', visitors: 1000, conversions: 50 };
    expect(calculateConversionRate(variant)).toBe(0.05);
  });

  it('should handle zero visitors', () => {
    const variant: VariantData = { name: 'A', visitors: 0, conversions: 0 };
    expect(calculateConversionRate(variant)).toBe(0);
  });
});

describe('calculateStandardError', () => {
  it('should calculate standard error for proportion', () => {
    const se = calculateStandardError(0.5, 100);
    expect(se).toBeCloseTo(0.05, 2);
  });

  it('should handle zero sample size', () => {
    expect(calculateStandardError(0.5, 0)).toBe(0);
  });
});

describe('pValueFromZScore', () => {
  it('should calculate p-value from z-score', () => {
    const pValue = pValueFromZScore(1.96);
    expect(pValue).toBeCloseTo(0.05, 2);
  });

  it('should handle negative z-score', () => {
    const pValue = pValueFromZScore(-1.96);
    expect(pValue).toBeCloseTo(0.05, 2);
  });
});

describe('zScoreFromPValue', () => {
  it('should calculate z-score from p-value', () => {
    const zScore = zScoreFromPValue(0.05);
    expect(zScore).toBeGreaterThan(1.5);
  });
});

describe('frequentistTest', () => {
  it('should detect significant difference', () => {
    const variantA: VariantData = { name: 'A', visitors: 10000, conversions: 500 };
    const variantB: VariantData = { name: 'B', visitors: 10000, conversions: 650 };
    const result = frequentistTest(variantA, variantB);
    expect(result.isSignificant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.relativeLift).toBeGreaterThan(20);
  });

  it('should handle inconclusive test', () => {
    const variantA: VariantData = { name: 'A', visitors: 1000, conversions: 50 };
    const variantB: VariantData = { name: 'B', visitors: 1000, conversions: 55 };
    const result = frequentistTest(variantA, variantB);
    expect(result.isSignificant).toBe(false);
    expect(result.pValue).toBeGreaterThan(0.05);
  });

  it('should calculate confidence interval', () => {
    const variantA: VariantData = { name: 'A', visitors: 5000, conversions: 250 };
    const variantB: VariantData = { name: 'B', visitors: 5000, conversions: 300 };
    const result = frequentistTest(variantA, variantB);
    expect(result.confidenceInterval.lower).toBeDefined();
    expect(result.confidenceInterval.upper).toBeDefined();
  });
});

describe('bayesianTest', () => {
  it('should calculate probability B beats A', () => {
    const variantA: VariantData = { name: 'A', visitors: 10000, conversions: 500 };
    const variantB: VariantData = { name: 'B', visitors: 10000, conversions: 650 };
    const result = bayesianTest(variantA, variantB);
    expect(result.probabilityBBeatsA).toBeGreaterThan(0.95);
  });

  it('should calculate Bayes Factor', () => {
    const variantA: VariantData = { name: 'A', visitors: 5000, conversions: 250 };
    const variantB: VariantData = { name: 'B', visitors: 5000, conversions: 300 };
    const result = bayesianTest(variantA, variantB);
    expect(result.bayesFactor).toBeGreaterThan(0);
  });

  it('should determine evidence strength', () => {
    const variantA: VariantData = { name: 'A', visitors: 10000, conversions: 500 };
    const variantB: VariantData = { name: 'B', visitors: 10000, conversions: 650 };
    const result = bayesianTest(variantA, variantB);
    expect(['weak', 'moderate', 'strong', 'decisive', 'inconclusive']).toContain(result.evidenceStrength);
  });

  it('should calculate expected loss', () => {
    const variantA: VariantData = { name: 'A', visitors: 5000, conversions: 250 };
    const variantB: VariantData = { name: 'B', visitors: 5000, conversions: 300 };
    const result = bayesianTest(variantA, variantB);
    expect(result.expectedLossA).toBeGreaterThanOrEqual(0);
    expect(result.expectedLossB).toBeGreaterThanOrEqual(0);
  });
});

describe('probabilityBEatsA', () => {
  it('should return high probability for better variant', () => {
    const prob = probabilityBEatsA(500, 10000, 650, 10000);
    expect(prob).toBeGreaterThan(0.9);
  });

  it('should return low probability for worse variant', () => {
    const prob = probabilityBEatsA(650, 10000, 500, 10000);
    expect(prob).toBeLessThan(0.1);
  });
});

describe('estimateSampleSize', () => {
  it('should calculate sample size for standard test', () => {
    const config: SampleSizeConfig = {
      baselineRate: 0.05,
      minimumEffect: 0.2,
      power: 0.8,
      alpha: 0.05,
    };
    const result = estimateSampleSize(config);
    expect(result.sampleSizePerVariant).toBeGreaterThan(100);
    expect(result.isSufficient).toBe(false);
  });

  it('should handle small effect sizes', () => {
    const config: SampleSizeConfig = {
      baselineRate: 0.1,
      minimumEffect: 0.05,
      power: 0.9,
    };
    const result = estimateSampleSize(config);
    expect(result.sampleSizePerVariant).toBeGreaterThan(1000);
  });
});

describe('checkSampleSufficiency', () => {
  it('should determine sample is sufficient', () => {
    const required = estimateSampleSize({
      baselineRate: 0.05,
      minimumEffect: 0.2,
    });
    const result = checkSampleSufficiency(required.sampleSizePerVariant * 2, required);
    expect(result.isSufficient).toBe(true);
    expect(result.progressPercent).toBe(200);
  });

  it('should estimate days to completion', () => {
    const required = estimateSampleSize({
      baselineRate: 0.05,
      minimumEffect: 0.2,
    });
    const result = checkSampleSufficiency(required.sampleSizePerVariant / 2, required, 1000);
    expect(result.estimatedDays).toBeDefined();
  });
});

describe('multivariateTest', () => {
  it('should handle A/B/n test', () => {
    const variants: VariantData[] = [
      { name: 'A', visitors: 5000, conversions: 250 },
      { name: 'B', visitors: 5000, conversions: 300 },
      { name: 'C', visitors: 5000, conversions: 275 },
    ];
    const result = multivariateTest(variants);
    expect(result.variantCount).toBe(3);
    expect(result.bestVariant).toBeDefined();
    expect(result.correctionMethod).toBe('bonferroni');
  });

  it('should apply Bonferroni correction', () => {
    const variants: VariantData[] = [
      { name: 'A', visitors: 5000, conversions: 250 },
      { name: 'B', visitors: 5000, conversions: 300 },
      { name: 'C', visitors: 5000, conversions: 275 },
      { name: 'D', visitors: 5000, conversions: 260 },
    ];
    const result = multivariateTest(variants);
    expect(result.adjustedAlpha).toBeLessThan(0.05);
  });

  it('should generate recommendations', () => {
    const variants: VariantData[] = [
      { name: 'A', visitors: 5000, conversions: 250 },
      { name: 'B', visitors: 5000, conversions: 300 },
    ];
    const result = multivariateTest(variants);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe('analyzeABTest', () => {
  it('should analyze significant A/B test', () => {
    const result = analyzeABTest({
      testId: 'test-001',
      variants: [
        { name: 'A', visitors: 10000, conversions: 500 },
        { name: 'B', visitors: 10000, conversions: 650 },
      ],
    });
    expect(result.testId).toBe('test-001');
    expect(result.frequentist).toBeDefined();
    expect(result.summary.winner).toBeDefined();
    expect(result.summary.recommendation).toBeDefined();
  });

  it('should handle Bayesian analysis', () => {
    const result = analyzeABTest({
      testId: 'test-002',
      variants: [
        { name: 'A', visitors: 5000, conversions: 250 },
        { name: 'B', visitors: 5000, conversions: 300 },
      ],
      useBayesian: true,
    });
    expect(result.bayesian).toBeDefined();
    expect(result.bayesian?.probabilityBBeatsA).toBeDefined();
  });

  it('should handle multi-variant test', () => {
    const result = analyzeABTest({
      testId: 'test-003',
      variants: [
        { name: 'A', visitors: 5000, conversions: 250 },
        { name: 'B', visitors: 5000, conversions: 300 },
        { name: 'C', visitors: 5000, conversions: 275 },
      ],
    });
    expect(result.multivariate).toBeDefined();
    expect(result.multivariate?.variantCount).toBe(3);
  });

  it('should return all required fields', () => {
    const result = analyzeABTest({
      testId: 'test-004',
      variants: [
        { name: 'A', visitors: 1000, conversions: 50 },
        { name: 'B', visitors: 1000, conversions: 55 },
      ],
    });
    expect(result.analyzedAt).toBeInstanceOf(Date);
    expect(result.testId).toBe('test-004');
    expect(result.summary.confidence).toBeDefined();
  });
});

describe('Z_SCORES', () => {
  it('should have valid critical values', () => {
    expect(Z_SCORES[0.95]).toBeCloseTo(1.645, 2);
    expect(Z_SCORES[0.975]).toBeCloseTo(1.96, 2);
    expect(Z_SCORES[0.99]).toBeCloseTo(2.326, 2);
  });
});

describe('BAYES_THRESHOLDS', () => {
  it('should have valid evidence thresholds', () => {
    expect(BAYES_THRESHOLDS.weak).toBe(3);
    expect(BAYES_THRESHOLDS.moderate).toBe(10);
    expect(BAYES_THRESHOLDS.strong).toBe(30);
    expect(BAYES_THRESHOLDS.decisive).toBe(100);
  });
});

describe('SAMPLE_DATA', () => {
  it('should have valid significant test data', () => {
    expect(SAMPLE_DATA.significantTest.control.visitors).toBe(10000);
    expect(SAMPLE_DATA.significantTest.treatment.conversions).toBe(650);
  });

  it('should have valid inconclusive test data', () => {
    expect(SAMPLE_DATA.inconclusiveTest.control.visitors).toBe(1000);
    expect(SAMPLE_DATA.inconclusiveTest.treatment.conversions).toBe(55);
  });

  it('should have valid multivariate test data', () => {
    expect(SAMPLE_DATA.multivariateTest.variants.length).toBe(3);
    expect(SAMPLE_DATA.multivariateTest.variants[0].name).toBe('A');
  });
});
