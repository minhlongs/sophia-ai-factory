/**
 * A/B Test Statistical Engine
 *
 * Significance calculator, sample size estimator, Bayesian confidence scoring,
 * and multi-variant (A/B/n) support for experimentation platforms.
 *
 * @module ABTestEngine
 * @version 1.0.0
 */

/**
 * Statistical test variant data
 */
export interface VariantData {
  /** Variant identifier (e.g., 'A', 'B', 'C') */
  name: string;
  /** Number of visitors/exposures */
  visitors: number;
  /** Number of conversions */
  conversions: number;
  /** Revenue generated (optional) */
  revenue?: number;
}

/**
 * Frequentist test result
 */
export interface FrequentistResult {
  /** Variant A conversion rate */
  conversionRateA: number;
  /** Variant B conversion rate */
  conversionRateB: number;
  /** Relative lift percentage */
  relativeLift: number;
  /** Z-score for significance test */
  zScore: number;
  /** P-value (two-tailed) */
  pValue: number;
  /** Is statistically significant at alpha level */
  isSignificant: boolean;
  /** Confidence level (1 - pValue) */
  confidenceLevel: number;
  /** Standard error of difference */
  standardError: number;
  /** Confidence interval for lift */
  confidenceInterval: { lower: number; upper: number };
}

/**
 * Bayesian test result
 */
export interface BayesianResult {
  /** Probability B beats A */
  probabilityBBeatsA: number;
  /** Probability A beats B */
  probabilityABeatsB: number;
  /** Expected loss if choosing B */
  expectedLossB: number;
  /** Expected loss if choosing A */
  expectedLossA: number;
  /** Credible interval for lift */
  credibleInterval: { lower: number; upper: number; probability: number };
  /** Bayes Factor (evidence ratio) */
  bayesFactor: number;
  /** Evidence strength: 'inconclusive' | 'weak' | 'moderate' | 'strong' | 'decisive' */
  evidenceStrength: 'inconclusive' | 'weak' | 'moderate' | 'strong' | 'decisive';
}

/**
 * Sample size estimation config
 */
export interface SampleSizeConfig {
  /** Baseline conversion rate (0-1) */
  baselineRate: number;
  /** Minimum detectable effect (0-1, e.g., 0.05 for 5%) */
  minimumEffect: number;
  /** Statistical power (0-1, typically 0.8 or 0.9) */
  power?: number;
  /** Significance level alpha (0-1, typically 0.05) */
  alpha?: number;
  /** Two-tailed test (default: true) */
  twoTailed?: boolean;
}

/**
 * Sample size estimation result
 */
export interface SampleSizeResult {
  /** Required sample size per variant */
  sampleSizePerVariant: number;
  /** Total sample size needed */
  totalSampleSize: number;
  /** Days to reach significance at current traffic */
  estimatedDays?: number;
  /** Current statistical power */
  currentPower?: number;
  /** Is current sample sufficient */
  isSufficient: boolean;
  /** Progress percentage toward goal */
  progressPercent: number;
}

/**
 * Multi-variant (A/B/n) test result
 */
export interface MultivariateResult {
  /** Total variants in test */
  variantCount: number;
  /** Best performing variant */
  bestVariant: string;
  /** Conversion rates for all variants */
  conversionRates: Record<string, number>;
  /** P-values for each comparison (vs control) */
  pValues: Record<string, number>;
  /** Bayesian probabilities */
  winProbabilities: Record<string, number>;
  /** Multiple comparison correction applied */
  correctionMethod: 'bonferroni' | 'holm' | 'none';
  /** Adjusted significance threshold */
  adjustedAlpha: number;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Sequential test monitoring result
 */
export interface SequentialTestResult {
  /** Current estimated lift */
  currentLift: number;
  /** Current confidence level */
  currentConfidence: number;
  /** Is test ready to stop (significant result) */
  canStop: boolean;
  /** Stop reason: 'significant' | 'futility' | 'inconclusive' */
  stopReason?: 'significant' | 'futility' | 'inconclusive';
  /** Recommended action */
  recommendation: string;
  /** Alpha spending so far */
  alphaSpent: number;
  /** Remaining alpha budget */
  alphaRemaining: number;
}

/**
 * Complete A/B test analysis input
 */
export interface ABTestInput {
  testId: string;
  variants: VariantData[];
  alpha?: number;
  useBayesian?: boolean;
  correctionMethod?: 'bonferroni' | 'holm' | 'none';
}

/**
 * Complete A/B test analysis result
 */
export interface ABTestResult {
  analyzedAt: Date;
  testId: string;
  frequentist?: FrequentistResult;
  bayesian?: BayesianResult;
  multivariate?: MultivariateResult;
  summary: {
    winner: string | null;
    confidence: number;
    recommendation: string;
  };
}

/**
 * Z-score critical values for common confidence levels
 */
export const Z_SCORES: Record<number, number> = {
  0.9: 1.282,
  0.95: 1.645,
  0.975: 1.96,
  0.99: 2.326,
  0.995: 2.576,
};

/**
 * Evidence strength thresholds for Bayes Factor
 */
export const BAYES_THRESHOLDS = {
  weak: 3,
  moderate: 10,
  strong: 30,
  decisive: 100,
};

/**
 * Calculate conversion rate from variant data
 */
export function calculateConversionRate(variant: VariantData): number {
  return variant.visitors > 0 ? variant.conversions / variant.visitors : 0;
}

/**
 * Calculate standard error for a proportion
 */
export function calculateStandardError(rate: number, sampleSize: number): number {
  if (sampleSize <= 0) return 0;
  return Math.sqrt((rate * (1 - rate)) / sampleSize);
}

/**
 * Calculate Z-score from p-value (inverse normal CDF approximation)
 */
export function zScoreFromPValue(pValue: number): number {
  if (pValue <= 0 || pValue >= 1) return 0;
  // Approximation for two-tailed test
  const adjustedP = pValue / 2;
  if (adjustedP >= 0.5) return 0;
  // Rational approximation
  const t = Math.sqrt(-2 * Math.log(adjustedP));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;
  return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}

/**
 * Calculate p-value from Z-score (normal CDF approximation)
 */
export function pValueFromZScore(zScore: number): number {
  // Approximation using error function
  const x = Math.abs(zScore);
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 2 * prob; // Two-tailed
}

/**
 * Perform frequentist significance test (two-proportion Z-test)
 */
export function frequentistTest(variantA: VariantData, variantB: VariantData, alpha = 0.05): FrequentistResult {
  const rateA = calculateConversionRate(variantA);
  const rateB = calculateConversionRate(variantB);

  // Pooled proportion
  const totalVisitors = variantA.visitors + variantB.visitors;
  const totalConversions = variantA.conversions + variantB.conversions;
  const pooledRate = totalVisitors > 0 ? totalConversions / totalVisitors : 0;

  // Standard error of difference
  const se = Math.sqrt(
    pooledRate * (1 - pooledRate) * (1 / variantA.visitors + 1 / variantB.visitors)
  );

  // Z-score
  const zScore = se > 0 ? (rateB - rateA) / se : 0;

  // P-value (two-tailed)
  const pValue = pValueFromZScore(zScore);

  // Relative lift
  const relativeLift = rateA > 0 ? ((rateB - rateA) / rateA) * 100 : 0;

  // Confidence interval for lift
  const zCritical = Z_SCORES[0.975] || 1.96;
  const liftSE = rateA > 0 ? Math.sqrt((rateA * (1 - rateA)) / variantA.visitors + (rateB * (1 - rateB)) / variantB.visitors) / rateA : 0;
  const lift = relativeLift / 100;

  return {
    conversionRateA: rateA,
    conversionRateB: rateB,
    relativeLift: Math.round(relativeLift * 100) / 100,
    zScore: Math.round(zScore * 1000) / 1000,
    pValue: Math.round(pValue * 10000) / 10000,
    isSignificant: pValue < alpha,
    confidenceLevel: Math.round((1 - pValue) * 10000) / 10000,
    standardError: Math.round(se * 100000) / 100000,
    confidenceInterval: {
      lower: Math.round((lift - zCritical * liftSE) * 10000) / 100,
      upper: Math.round((lift + zCritical * liftSE) * 10000) / 100,
    },
  };
}

/**
 * Beta distribution helper for Bayesian calculations
 */
function betaMean(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

function betaVariance(alpha: number, beta: number): number {
  const sum = alpha + beta;
  return (alpha * beta) / (sum * sum * (sum + 1));
}

/**
 * Approximate probability that Beta(a1, b1) > Beta(a2, b2)
 * Using normal approximation for large samples
 */
export function probabilityBEatsA(
  conversionsA: number,
  visitorsA: number,
  conversionsB: number,
  visitorsB: number,
  prior = 1
): number {
  // Posterior parameters (Beta distribution with uniform prior)
  const alpha1 = conversionsA + prior;
  const beta1 = visitorsA - conversionsA + prior;
  const alpha2 = conversionsB + prior;
  const beta2 = visitorsB - conversionsB + prior;

  // Normal approximation
  const mean1 = betaMean(alpha1, beta1);
  const mean2 = betaMean(alpha2, beta2);
  const var1 = betaVariance(alpha1, beta1);
  const var2 = betaVariance(alpha2, beta2);

  // P(B > A) ≈ P(N(0,1) > (mean1 - mean2) / sqrt(var1 + var2))
  const diff = mean2 - mean1;
  const se = Math.sqrt(var1 + var2);
  const zScore = se > 0 ? diff / se : 0;

  // Standard normal CDF using approximation
  return 0.5 * (1 + erf(zScore / Math.sqrt(2)));
}

/**
 * Error function (erf) approximation using Abramowitz & Stegun
 */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Perform Bayesian A/B test
 */
export function bayesianTest(
  variantA: VariantData,
  variantB: VariantData,
  prior = 1
): BayesianResult {
  const rateA = calculateConversionRate(variantA);
  const rateB = calculateConversionRate(variantB);

  // P(B > A)
  const probBBeatsA = probabilityBEatsA(
    variantA.conversions,
    variantA.visitors,
    variantB.conversions,
    variantB.visitors,
    prior
  );
  const probABeatsB = 1 - probBBeatsA;

  // Expected loss (simplified - difference in conversion rates weighted by probability)
  const rateDiff = rateB - rateA;
  const expectedLossB = rateDiff < 0 ? Math.abs(rateDiff) * probABeatsB : 0;
  const expectedLossA = rateDiff > 0 ? rateDiff * probABeatsB : 0;

  // Bayes Factor approximation (using BIC approximation)
  const n = variantA.visitors + variantB.visitors;
  const k = 1; // parameters
  const logBF = 0.5 * (Math.log(n) - k * Math.log(2 * Math.PI));
  const bayesFactor = Math.exp(logBF * Math.abs(rateDiff) * 10);

  // Evidence strength
  let evidenceStrength: 'inconclusive' | 'weak' | 'moderate' | 'strong' | 'decisive';
  if (bayesFactor < BAYES_THRESHOLDS.weak) evidenceStrength = 'inconclusive';
  else if (bayesFactor < BAYES_THRESHOLDS.moderate) evidenceStrength = 'weak';
  else if (bayesFactor < BAYES_THRESHOLDS.strong) evidenceStrength = 'moderate';
  else if (bayesFactor < BAYES_THRESHOLDS.decisive) evidenceStrength = 'strong';
  else evidenceStrength = 'decisive';

  // Credible interval (simplified - using normal approximation)
  const pooledVar = betaVariance(variantA.conversions + prior, variantA.visitors - variantA.conversions + prior) +
    betaVariance(variantB.conversions + prior, variantB.visitors - variantB.conversions + prior);
  const pooledSE = Math.sqrt(pooledVar);
  const zCritical = 1.96;

  return {
    probabilityBBeatsA: Math.round(probBBeatsA * 10000) / 10000,
    probabilityABeatsB: Math.round(probABeatsB * 10000) / 10000,
    expectedLossB: Math.round(expectedLossB * 100000) / 100000,
    expectedLossA: Math.round(expectedLossA * 100000) / 100000,
    credibleInterval: {
      lower: Math.round(((rateB - rateA) - zCritical * pooledSE) * 10000) / 100,
      upper: Math.round(((rateB - rateA) + zCritical * pooledSE) * 10000) / 100,
      probability: 0.95,
    },
    bayesFactor: Math.round(bayesFactor * 100) / 100,
    evidenceStrength,
  };
}

/**
 * Estimate required sample size
 */
export function estimateSampleSize(config: SampleSizeConfig): SampleSizeResult {
  const { baselineRate, minimumEffect, power = 0.8, alpha = 0.05, twoTailed = true } = config;

  // Z-scores
  const zAlpha = twoTailed ? Z_SCORES[1 - alpha / 2] : Z_SCORES[1 - alpha];
  const zBeta = Z_SCORES[power] || 0.84; // 0.84 for 80% power

  // Effect size (Cohen's h for proportions)
  const treatmentRate = baselineRate * (1 + minimumEffect);
  const h = 2 * (Math.asin(Math.sqrt(treatmentRate)) - Math.asin(Math.sqrt(baselineRate)));

  // Sample size per variant
  const sampleSizePerVariant = Math.ceil((2 * Math.pow(zAlpha + zBeta, 2)) / (h * h));

  return {
    sampleSizePerVariant,
    totalSampleSize: sampleSizePerVariant * 2,
    isSufficient: false,
    progressPercent: 0,
  };
}

/**
 * Check if current sample is sufficient
 */
export function checkSampleSufficiency(
  currentSample: number,
  requiredSample: SampleSizeResult,
  dailyTraffic?: number
): SampleSizeResult {
  const progressPercent = (currentSample / requiredSample.sampleSizePerVariant) * 100;
  const isSufficient = currentSample >= requiredSample.sampleSizePerVariant;

  let estimatedDays: number | undefined;
  if (dailyTraffic && dailyTraffic > 0 && !isSufficient) {
    estimatedDays = Math.ceil((requiredSample.sampleSizePerVariant - currentSample) / dailyTraffic);
  }

  return {
    ...requiredSample,
    estimatedDays,
    isSufficient,
    progressPercent: Math.round(progressPercent * 10) / 10,
  };
}

/**
 * Perform multi-variant (A/B/n) test with correction
 */
export function multivariateTest(
  variants: VariantData[],
  alpha = 0.05,
  correctionMethod: 'bonferroni' | 'holm' | 'none' = 'bonferroni'
): MultivariateResult {
  const control = variants[0];
  const treatmentVariants = variants.slice(1);

  // Calculate conversion rates
  const conversionRates: Record<string, number> = {};
  variants.forEach((v) => {
    conversionRates[v.name] = calculateConversionRate(v);
  });

  // Find best variant
  let bestVariant = control.name;
  let bestRate = conversionRates[control.name];
  variants.forEach((v) => {
    if (conversionRates[v.name] > bestRate) {
      bestRate = conversionRates[v.name];
      bestVariant = v.name;
    }
  });

  // P-values for each comparison
  const pValues: Record<string, number> = {};
  treatmentVariants.forEach((v) => {
    const result = frequentistTest(control, v, alpha);
    pValues[v.name] = result.pValue;
  });

  // Adjusted alpha for multiple comparisons
  let adjustedAlpha = alpha;
  if (correctionMethod === 'bonferroni') {
    adjustedAlpha = alpha / treatmentVariants.length;
  }

  // Win probabilities (simplified Bayesian)
  const winProbabilities: Record<string, number> = {};
  variants.forEach((v) => {
    if (v.name === control.name) {
      winProbabilities[v.name] = 0; // Control doesn't "win" against itself
    } else {
      const result = bayesianTest(control, v);
      winProbabilities[v.name] = result.probabilityBBeatsA;
    }
  });
  winProbabilities[control.name] = 1 - Object.values(winProbabilities).reduce((a, b) => a + b, 0) / treatmentVariants.length;

  // Recommendations
  const recommendations: string[] = [];
  const significantWinners = treatmentVariants.filter((v) => {
    const adjustedP = correctionMethod === 'bonferroni' ? pValues[v.name] * treatmentVariants.length : pValues[v.name];
    return adjustedP < alpha;
  });

  if (significantWinners.length > 0) {
    recommendations.push(`Deploy winner: ${bestVariant} (significant at ${correctionMethod}-corrected alpha)`);
  } else {
    recommendations.push('No significant winner yet - continue test or increase sample size');
  }

  if (treatmentVariants.length > 3) {
    recommendations.push('Consider simplifying test - too many variants may reduce power');
  }

  return {
    variantCount: variants.length,
    bestVariant,
    conversionRates,
    pValues,
    winProbabilities,
    correctionMethod,
    adjustedAlpha,
    recommendations,
  };
}

/**
 * Main A/B test analysis function
 */
export function analyzeABTest(input: ABTestInput): ABTestResult {
  const { testId, variants, alpha = 0.05, useBayesian = false, correctionMethod = 'none' } = input;

  let frequentist: FrequentistResult | undefined;
  let bayesian: BayesianResult | undefined;
  let multivariate: MultivariateResult | undefined;

  if (variants.length === 2) {
    // Simple A/B test
    frequentist = frequentistTest(variants[0], variants[1], alpha);

    if (useBayesian || variants.length > 2) {
      bayesian = bayesianTest(variants[0], variants[1]);
    }
  } else {
    // Multi-variant test
    multivariate = multivariateTest(variants, alpha, correctionMethod as 'bonferroni' | 'holm' | 'none');
  }

  // Determine winner
  let winner: string | null = null;
  let confidence = 0;
  let recommendation = 'Insufficient data';

  if (frequentist && frequentist.isSignificant) {
    winner = frequentist.conversionRateB > frequentist.conversionRateA ? variants[1].name : variants[0].name;
    confidence = frequentist.confidenceLevel;
    recommendation = `Deploy ${winner} - statistically significant (${(confidence * 100).toFixed(1)}% confidence)`;
  } else if (bayesian && bayesian.probabilityBBeatsA > 0.95) {
    winner = variants[1].name;
    confidence = bayesian.probabilityBBeatsA;
    recommendation = `Deploy ${winner} - high Bayesian confidence (${(confidence * 100).toFixed(1)}%)`;
  } else if (multivariate) {
    winner = multivariate.bestVariant;
    confidence = multivariate.winProbabilities[winner] || 0;
    recommendation = multivariate.recommendations[0];
  }

  return {
    analyzedAt: new Date(),
    testId,
    frequentist,
    bayesian,
    multivariate,
    summary: {
      winner,
      confidence: Math.round(confidence * 10000) / 10000,
      recommendation,
    },
  };
}

/**
 * Sample data for testing
 */
export const SAMPLE_DATA = {
  significantTest: {
    control: { name: 'A', visitors: 10000, conversions: 500 } as VariantData,
    treatment: { name: 'B', visitors: 10000, conversions: 650 } as VariantData,
  },
  inconclusiveTest: {
    control: { name: 'A', visitors: 1000, conversions: 50 } as VariantData,
    treatment: { name: 'B', visitors: 1000, conversions: 55 } as VariantData,
  },
  multivariateTest: {
    variants: [
      { name: 'A', visitors: 5000, conversions: 250 },
      { name: 'B', visitors: 5000, conversions: 300 },
      { name: 'C', visitors: 5000, conversions: 275 },
    ] as VariantData[],
  },
};

export default {
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
};

