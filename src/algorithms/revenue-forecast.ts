/**
 * Revenue Forecasting Model
 *
 * MRR projection, cohort analysis, seasonal adjustments, and confidence intervals.
 *
 * @module RevenueForecast
 * @version 1.0.0
 */

/**
 * Revenue tier information
 */
export type RevenueTier = 'starter' | 'growth' | 'premium' | 'master';

/**
 * Monthly recurring revenue data
 */
export interface MRRData {
  /** Month in YYYY-MM format */
  month: string;
  /** Starting MRR */
  startingMRR: number;
  /** New MRR from new customers */
  newMRR: number;
  /** Expansion MRR from upgrades */
  expansionMRR: number;
  /** Contraction MRR from downgrades */
  contractionMRR: number;
  /** Churned MRR */
  churnedMRR: number;
  /** Reactivated MRR */
  reactivatedMRR: number;
}

/**
 * Cohort metrics
 */
export interface CohortMetrics {
  /** Cohort month (YYYY-MM) */
  cohortMonth: string;
  /** Initial customers count */
  initialCustomers: number;
  /** Month-over-month retention rates (0-1) */
  retentionRates: number[];
  /** Average MRR per customer */
  avgMRRPerCustomer: number;
  /** Expansion rate (0-1) */
  expansionRate: number;
  /** Churn rate trend (0-1) */
  churnRate: number;
}

/**
 * Seasonal adjustment factors by month
 */
export interface SeasonalFactors {
  /** Month index (0-11) */
  month: number;
  /** Adjustment factor (0.8-1.2 typical) */
  factor: number;
  /** Description */
  description?: string;
}

/**
 * Forecast configuration
 */
export interface ForecastConfig {
  /** Forecast horizon in months */
  horizonMonths: number;
  /** Confidence level (0.80, 0.90, 0.95) */
  confidenceLevel: number;
  /** Include seasonal adjustments */
  includeSeasonality: boolean;
  /** Include cohort analysis */
  includeCohorts: boolean;
}

/**
 * Monthly forecast result
 */
export interface MonthlyForecast {
  /** Month (YYYY-MM) */
  month: string;
  /** Projected MRR */
  projectedMRR: number;
  /** Lower bound of confidence interval */
  lowerBound: number;
  /** Upper bound of confidence interval */
  upperBound: number;
  /** Confidence level */
  confidenceLevel: number;
  /** Month-over-month growth rate */
  growthRate: number;
  /** Cumulative MRR */
  cumulativeMRR: number;
}

/**
 * Revenue forecast summary
 */
export interface RevenueForecastResult {
  forecastedAt: Date;
  config: ForecastConfig;
  startingMRR: number;
  endingMRR: number;
  totalGrowth: number;
  cagr: number;
  monthlyForecasts: MonthlyForecast[];
  cohortContribution?: number;
  seasonalImpact?: number;
}

/**
 * Calculate net MRR change
 */
export function calculateNetMRRChange(data: MRRData): number {
  return (
    data.newMRR +
    data.expansionMRR -
    data.contractionMRR -
    data.churnedMRR +
    data.reactivatedMRR
  );
}

/**
 * Calculate ending MRR
 */
export function calculateEndingMRR(data: MRRData): number {
  return data.startingMRR + calculateNetMRRChange(data);
}

/**
 * Calculate MRR growth rate
 */
export function calculateMRRGrowthRate(data: MRRData): number {
  if (data.startingMRR === 0) return 0;
  const netChange = calculateNetMRRChange(data);
  return netChange / data.startingMRR;
}

/**
 * Calculate churn rate
 */
export function calculateChurnRate(data: MRRData): number {
  if (data.startingMRR === 0) return 0;
  return data.churnedMRR / data.startingMRR;
}

/**
 * Calculate expansion rate
 */
export function calculateExpansionRate(data: MRRData): number {
  if (data.startingMRR === 0) return 0;
  return data.expansionMRR / data.startingMRR;
}

/**
 * Calculate quick ratio (growth efficiency)
 */
export function calculateQuickRatio(data: MRRData): number {
  const churn = data.churnedMRR + data.contractionMRR;
  if (churn === 0) return 999; // Infinite if no churn
  return (data.newMRR + data.expansionMRR) / churn;
}

/**
 * Default seasonal factors (based on SaaS patterns)
 */
export const DEFAULT_SEASONAL_FACTORS: SeasonalFactors[] = [
  { month: 0, factor: 0.95, description: 'January - post-holiday slowdown' },
  { month: 1, factor: 0.98, description: 'February - recovery' },
  { month: 2, factor: 1.05, description: 'March - Q1 end push' },
  { month: 3, factor: 1.08, description: 'April - Q2 start momentum' },
  { month: 4, factor: 1.05, description: 'May - steady' },
  { month: 5, factor: 1.10, description: 'June - Q2 end push' },
  { month: 6, factor: 0.90, description: 'July - summer slowdown' },
  { month: 7, factor: 0.92, description: 'August - summer continues' },
  { month: 8, factor: 1.08, description: 'September - Q3 ramp up' },
  { month: 9, factor: 1.05, description: 'October - steady' },
  { month: 10, factor: 1.10, description: 'November - Q4 push' },
  { month: 11, factor: 0.85, description: 'December - holidays' },
];

/**
 * Get seasonal factor for a month
 */
export function getSeasonalFactor(
  monthIndex: number,
  factors: SeasonalFactors[] = DEFAULT_SEASONAL_FACTORS
): number {
  const factor = factors.find((f) => f.month === monthIndex);
  return factor?.factor || 1.0;
}

/**
 * Apply seasonal adjustment to MRR
 */
export function applySeasonalAdjustment(
  mrr: number,
  monthIndex: number,
  factors?: SeasonalFactors[]
): number {
  const factor = getSeasonalFactor(monthIndex, factors);
  return mrr * factor;
}

/**
 * Project cohort revenue based on retention curves
 */
export function projectCohortRevenue(
  cohort: CohortMetrics,
  monthsToProject: number
): number[] {
  const revenues: number[] = [];
  let customers = cohort.initialCustomers;
  let cumulativeRevenue = 0;

  for (let i = 0; i < monthsToProject; i++) {
    const retentionRate = cohort.retentionRates[i] || cohort.retentionRates[cohort.retentionRates.length - 1] || 0;
    customers = customers * retentionRate;
    const monthlyRevenue = customers * cohort.avgMRRPerCustomer * (1 + cohort.expansionRate);
    revenues.push(monthlyRevenue);
    cumulativeRevenue += monthlyRevenue;
  }

  return revenues;
}

/**
 * Calculate confidence intervals using normal approximation
 */
export function calculateConfidenceInterval(
  mean: number,
  standardDeviation: number,
  sampleSize: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number; margin: number } {
  // Z-scores for common confidence levels
  const zScores: Record<number, number> = {
    0.80: 1.28,
    0.85: 1.44,
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };

  const z = zScores[confidenceLevel] || 1.96;
  const standardError = standardDeviation / Math.sqrt(sampleSize);
  const margin = z * standardError;

  return {
    lower: Math.max(0, mean - margin),
    upper: mean + margin,
    margin,
  };
}

/**
 * Calculate historical volatility (standard deviation of growth rates)
 */
export function calculateVolatility(growthRates: number[]): number {
  if (growthRates.length < 2) return 0.1; // Default 10% volatility

  const mean = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
  const variance = growthRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / growthRates.length;
  return Math.sqrt(variance);
}

/**
 * Project MRR with growth rate and seasonality
 */
export function projectMRR(
  currentMRR: number,
  monthlyGrowthRate: number,
  months: number,
  includeSeasonality: boolean = true,
  volatility: number = 0.1,
  useRandomness: boolean = false
): MonthlyForecast[] {
  const forecasts: MonthlyForecast[] = [];
  let projectedMRR = currentMRR;
  let cumulativeMRR = currentMRR;
  const startDate = new Date();

  for (let i = 1; i <= months; i++) {
    const forecastDate = new Date(startDate);
    forecastDate.setMonth(forecastDate.getMonth() + i);
    const monthStr = forecastDate.toISOString().slice(0, 7); // YYYY-MM
    const monthIndex = forecastDate.getMonth();

    // Base projection with growth
    let rawProjection = projectedMRR * (1 + monthlyGrowthRate);

    // Apply seasonal adjustment
    let finalProjection = rawProjection;
    if (includeSeasonality) {
      finalProjection = applySeasonalAdjustment(rawProjection, monthIndex);
    }

    // Add randomness based on volatility (only if explicitly enabled)
    if (useRandomness && volatility > 0) {
      const randomFactor = 1 + (Math.random() - 0.5) * 2 * volatility;
      finalProjection = Math.max(0, finalProjection * randomFactor);
    }

    // Calculate confidence interval
    const interval = calculateConfidenceInterval(
      finalProjection,
      finalProjection * volatility,
      12, // Sample size
      0.90
    );

    const growthRate = (finalProjection - projectedMRR) / projectedMRR;

    forecasts.push({
      month: monthStr,
      projectedMRR: Math.round(finalProjection * 100) / 100,
      lowerBound: Math.round(interval.lower * 100) / 100,
      upperBound: Math.round(interval.upper * 100) / 100,
      confidenceLevel: 0.90,
      growthRate: Math.round(growthRate * 10000) / 100,
      cumulativeMRR: Math.round((cumulativeMRR + finalProjection) * 100) / 100,
    });

    projectedMRR = finalProjection;
    cumulativeMRR += finalProjection;
  }

  return forecasts;
}

/**
 * Calculate CAGR from MRR series
 */
export function calculateCAGR(
  startingMRR: number,
  endingMRR: number,
  months: number
): number {
  if (startingMRR === 0 || months === 0) return 0;
  const years = months / 12;
  return Math.pow(endingMRR / startingMRR, 1 / years) - 1;
}

/**
 * Main revenue forecast function
 */
export function forecastRevenue(
  historicalData: MRRData[],
  cohorts: CohortMetrics[],
  config: ForecastConfig
): RevenueForecastResult {
  // Calculate current MRR and growth rate from historical data
  const currentMonth = historicalData[historicalData.length - 1];
  const currentMRR = calculateEndingMRR(currentMonth);
  const historicalGrowthRates = historicalData.map(calculateMRRGrowthRate);
  const avgGrowthRate = historicalGrowthRates.reduce((a, b) => a + b, 0) / historicalGrowthRates.length;
  const volatility = calculateVolatility(historicalGrowthRates);

  // Generate monthly forecasts (deterministic by default for consistent projections)
  const monthlyForecasts = projectMRR(
    currentMRR,
    avgGrowthRate,
    config.horizonMonths,
    config.includeSeasonality,
    volatility,
    false // Deterministic projection
  );

  // Calculate cohort contribution if enabled
  let cohortContribution: number | undefined;
  if (config.includeCohorts && cohorts.length > 0) {
    const cohortRevenue = cohorts.reduce((total, cohort) => {
      const revenues = projectCohortRevenue(cohort, config.horizonMonths);
      return total + revenues.reduce((a, b) => a + b, 0);
    }, 0);
    cohortContribution = cohortRevenue / monthlyForecasts.reduce((sum, f) => sum + f.projectedMRR, 0);
  }

  // Calculate seasonal impact
  let seasonalImpact: number | undefined;
  if (config.includeSeasonality) {
    const withSeasonality = monthlyForecasts.reduce((sum, f) => sum + f.projectedMRR, 0);
    const withoutSeasonality = projectMRR(currentMRR, avgGrowthRate, config.horizonMonths, false, volatility, false)
      .reduce((sum, f) => sum + f.projectedMRR, 0);
    seasonalImpact = (withSeasonality - withoutSeasonality) / withoutSeasonality;
  }

  const endingMRR = monthlyForecasts[monthlyForecasts.length - 1].projectedMRR;
  const totalGrowth = endingMRR - currentMRR;
  const cagr = calculateCAGR(currentMRR, endingMRR, config.horizonMonths);

  return {
    forecastedAt: new Date(),
    config,
    startingMRR: currentMRR,
    endingMRR,
    totalGrowth,
    cagr,
    monthlyForecasts,
    cohortContribution,
    seasonalImpact,
  };
}

/**
 * Sample data for testing and demonstration
 */
export const SAMPLE_DATA = {
  historicalMRR: [
    { month: '2025-10', startingMRR: 85000, newMRR: 12000, expansionMRR: 3000, contractionMRR: 1000, churnedMRR: 4000, reactivatedMRR: 500 } as MRRData,
    { month: '2025-11', startingMRR: 95500, newMRR: 15000, expansionMRR: 4000, contractionMRR: 1500, churnedMRR: 5000, reactivatedMRR: 800 } as MRRData,
    { month: '2025-12', startingMRR: 107800, newMRR: 10000, expansionMRR: 3500, contractionMRR: 1200, churnedMRR: 3000, reactivatedMRR: 400 } as MRRData,
    { month: '2026-01', startingMRR: 117500, newMRR: 14000, expansionMRR: 5000, contractionMRR: 2000, churnedMRR: 4500, reactivatedMRR: 600 } as MRRData,
    { month: '2026-02', startingMRR: 130600, newMRR: 18000, expansionMRR: 6000, contractionMRR: 2500, churnedMRR: 5500, reactivatedMRR: 1000 } as MRRData,
  ] as MRRData[],

  cohorts: [
    {
      cohortMonth: '2025-10',
      initialCustomers: 50,
      retentionRates: [1.0, 0.92, 0.88, 0.85, 0.83, 0.81],
      avgMRRPerCustomer: 450,
      expansionRate: 0.08,
      churnRate: 0.08,
    } as CohortMetrics,
    {
      cohortMonth: '2025-11',
      initialCustomers: 65,
      retentionRates: [1.0, 0.90, 0.86, 0.83, 0.80],
      avgMRRPerCustomer: 520,
      expansionRate: 0.10,
      churnRate: 0.10,
    } as CohortMetrics,
  ] as CohortMetrics[],

  config: {
    horizonMonths: 12,
    confidenceLevel: 0.90,
    includeSeasonality: true,
    includeCohorts: true,
  } as ForecastConfig,
};

export default {
  forecastRevenue,
  projectMRR,
  projectCohortRevenue,
  calculateNetMRRChange,
  calculateEndingMRR,
  calculateMRRGrowthRate,
  calculateChurnRate,
  calculateExpansionRate,
  calculateQuickRatio,
  calculateCAGR,
  calculateVolatility,
  calculateConfidenceInterval,
  applySeasonalAdjustment,
  getSeasonalFactor,
  DEFAULT_SEASONAL_FACTORS,
  SAMPLE_DATA,
};
