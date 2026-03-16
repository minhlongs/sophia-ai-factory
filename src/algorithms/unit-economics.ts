/**
 * Unit Economics Calculator
 *
 * LTV calculation, CAC payback period, gross margin optimizer,
 * and breakeven analysis for SaaS business metrics.
 *
 * @module UnitEconomics
 * @version 1.0.0
 */

/**
 * Customer lifetime value metrics
 */
export interface LTVMetrics {
  /** Average revenue per user per month */
  arpu: number;
  /** Gross margin percentage (0-100) */
  grossMarginPercent: number;
  /** Monthly churn rate (0-1) */
  churnRate: number;
  /** Discount rate for NPV (0-1, annual) */
  discountRate?: number;
}

/**
 * LTV calculation result
 */
export interface LTVResult {
  /** Simple LTV (ARPU * Gross Margin / Churn) */
  ltvSimple: number;
  /** NPV-adjusted LTV with discount rate */
  ltvNPV: number;
  /** Expected customer lifetime in months */
  expectedLifetime: number;
  /** LTV to CAC ratio */
  ltvToCacRatio?: number;
}

/**
 * CAC calculation input
 */
export interface CACMetrics {
  /** Total sales and marketing spend */
  totalSpend: number;
  /** Number of new customers acquired */
  newCustomers: number;
  /** Average revenue per user per month */
  arpu: number;
  /** Gross margin percentage (0-1) */
  grossMarginPercent: number;
}

/**
 * CAC payback result
 */
export interface CACPaybackResult {
  /** Customer acquisition cost */
  cac: number;
  /** Payback period in months */
  paybackMonths: number;
  /** Payback period in days */
  paybackDays: number;
  /** Months to profitability after payback */
  profitStartMonth: number;
  /** Health rating: 'excellent' | 'good' | 'warning' | 'critical' */
  health: 'excellent' | 'good' | 'warning' | 'critical';
}

/**
 * Gross margin configuration
 */
export interface GrossMarginConfig {
  /** Total revenue */
  revenue: number;
  /** Cost of goods sold */
  cogs: number;
  /** Variable costs (hosting, support, etc.) */
  variableCosts: number;
  /** Fixed costs (salaries, rent, etc.) */
  fixedCosts: number;
}

/**
 * Gross margin optimization result
 */
export interface GrossMarginResult {
  /** Current gross margin percentage */
  currentMargin: number;
  /** Optimized margin target */
  targetMargin: number;
  /** Margin improvement needed */
  improvementNeeded: number;
  /** Revenue lost to COGS */
  cogsImpact: number;
  /** Recommendations for improvement */
  recommendations: string[];
  /** Profit impact of 1% margin improvement */
  profitPerPoint: number;
}

/**
 * Breakeven analysis input
 */
export interface BreakevenInput {
  /** Fixed costs per month */
  fixedCosts: number;
  /** Variable cost per unit */
  variableCostPerUnit: number;
  /** Price per unit */
  pricePerUnit: number;
  /** Current monthly units sold */
  currentUnits?: number;
}

/**
 * Breakeven analysis result
 */
export interface BreakevenResult {
  /** Breakeven units per month */
  breakevenUnits: number;
  /** Breakeven revenue per month */
  breakevenRevenue: number;
  /** Current profit/loss */
  currentProfit: number;
  /** Units needed to add for breakeven */
  gapToBreakeven: number;
  /** Months to breakeven at current growth */
  monthsToBreakeven?: number;
  /** Safety margin percentage */
  safetyMargin: number;
}

/**
 * Complete unit economics input
 */
export interface UnitEconomicsInput {
  companyId: string;
  arpu: number;
  churnRate: number;
  grossMarginPercent: number;
  cac: number;
  fixedCosts: number;
  variableCostPerUnit: number;
  currentCustomers: number;
}

/**
 * Complete unit economics analysis result
 */
export interface UnitEconomicsResult {
  analyzedAt: Date;
  companyId: string;
  ltv: LTVResult;
  cacPayback: CACPaybackResult;
  grossMargin: GrossMarginResult;
  breakeven: BreakevenResult;
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  keyMetrics: {
    ltvToCacRatio: number;
    cacPaybackMonths: number;
    grossMarginPercent: number;
    runwayMonths?: number;
  };
  recommendations: string[];
}

/**
 * Health thresholds for unit economics
 */
export const HEALTH_THRESHOLDS = {
  ltvToCac: { excellent: 5, good: 3, warning: 1 },
  cacPayback: { excellent: 6, good: 12, warning: 18 },
  grossMargin: { excellent: 80, good: 70, warning: 50 },
};

/**
 * Calculate customer lifetime value
 */
export function calculateLTV(metrics: LTVMetrics, cac?: number): LTVResult {
  const { arpu, grossMarginPercent, churnRate, discountRate = 0.1 } = metrics;

  // Expected lifetime in months (1/churn)
  const expectedLifetime = churnRate > 0 ? 1 / churnRate : 120;

  // Monthly margin-adjusted revenue
  const marginRevenue = arpu * (grossMarginPercent / 100);

  // Simple LTV = ARPU * Gross Margin / Churn
  const ltvSimple = churnRate > 0 ? marginRevenue / churnRate : marginRevenue * 120;

  // NPV-adjusted LTV with monthly discount rate
  const monthlyDiscountRate = Math.pow(1 + discountRate, 1 / 12) - 1;
  const ltvNPV =
    churnRate > 0
      ? (marginRevenue * (1 - Math.pow(1 + monthlyDiscountRate, -expectedLifetime))) /
        monthlyDiscountRate
      : marginRevenue * 120;

  return {
    ltvSimple: Math.round(ltvSimple * 100) / 100,
    ltvNPV: Math.round(ltvNPV * 100) / 100,
    expectedLifetime: Math.round(expectedLifetime * 10) / 10,
    ltvToCacRatio: cac ? Math.round((ltvSimple / cac) * 10) / 10 : undefined,
  };
}

/**
 * Calculate CAC payback period
 */
export function calculateCACPayback(metrics: CACMetrics): CACPaybackResult {
  const { totalSpend, newCustomers, arpu, grossMarginPercent } = metrics;

  // CAC = Total Spend / New Customers
  const cac = newCustomers > 0 ? totalSpend / newCustomers : totalSpend;

  // Monthly contribution margin per customer
  const contributionMargin = arpu * (grossMarginPercent / 100);

  // Payback period = CAC / Monthly Contribution
  const paybackMonths = contributionMargin > 0 ? cac / contributionMargin : Infinity;

  // Convert to days
  const paybackDays = Math.round(paybackMonths * 30);

  // Determine health rating
  let health: 'excellent' | 'good' | 'warning' | 'critical';
  if (paybackMonths <= HEALTH_THRESHOLDS.cacPayback.excellent) {
    health = 'excellent';
  } else if (paybackMonths <= HEALTH_THRESHOLDS.cacPayback.good) {
    health = 'good';
  } else if (paybackMonths <= HEALTH_THRESHOLDS.cacPayback.warning) {
    health = 'warning';
  } else {
    health = 'critical';
  }

  return {
    cac: Math.round(cac * 100) / 100,
    paybackMonths: Math.round(paybackMonths * 10) / 10,
    paybackDays,
    profitStartMonth: Math.ceil(paybackMonths) + 1,
    health,
  };
}

/**
 * Analyze and optimize gross margin
 */
export function optimizeGrossMargin(config: GrossMarginConfig): GrossMarginResult {
  const { revenue, cogs, variableCosts, fixedCosts } = config;

  // Current gross margin
  const currentMargin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;

  // Target margin (SaaS benchmark: 80%+)
  const targetMargin = Math.min(85, currentMargin + 10);

  // Improvement needed
  const improvementNeeded = Math.max(0, targetMargin - currentMargin);

  // COGS impact
  const cogsImpact = cogs;

  // Profit impact of 1% margin improvement
  const profitPerPoint = revenue * 0.01;

  // Generate recommendations
  const recommendations: string[] = [];

  if (currentMargin < 50) {
    recommendations.push('Critical: Review hosting costs - consider optimization or migration');
    recommendations.push('Implement usage-based pricing to align costs with revenue');
    recommendations.push('Audit support costs - invest in self-service resources');
  } else if (currentMargin < 70) {
    recommendations.push('Optimize infrastructure costs with reserved instances');
    recommendations.push('Review third-party service costs for alternatives');
    recommendations.push('Implement auto-scaling to reduce waste');
  }

  if (variableCosts > revenue * 0.2) {
    recommendations.push('Variable costs too high - target <15% of revenue');
  }

  if (improvementNeeded > 5) {
    recommendations.push(`Target ${Math.round(targetMargin)}% margin - industry standard for SaaS`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain current margin structure');
    recommendations.push('Monitor for cost creep as you scale');
  }

  return {
    currentMargin: Math.round(currentMargin * 10) / 10,
    targetMargin,
    improvementNeeded: Math.round(improvementNeeded * 10) / 10,
    cogsImpact,
    recommendations,
    profitPerPoint: Math.round(profitPerPoint * 100) / 100,
  };
}

/**
 * Analyze breakeven point
 */
export function analyzeBreakeven(input: BreakevenInput): BreakevenResult {
  const { fixedCosts, variableCostPerUnit, pricePerUnit, currentUnits = 0 } = input;

  // Contribution margin per unit
  const contributionMargin = pricePerUnit - variableCostPerUnit;

  // Breakeven units = Fixed Costs / Contribution Margin
  const breakevenUnits = contributionMargin > 0 ? Math.ceil(fixedCosts / contributionMargin) : Infinity;

  // Breakeven revenue
  const breakevenRevenue = breakevenUnits * pricePerUnit;

  // Current profit/loss
  const currentRevenue = currentUnits * pricePerUnit;
  const currentCosts = fixedCosts + currentUnits * variableCostPerUnit;
  const currentProfit = currentRevenue - currentCosts;

  // Gap to breakeven
  const gapToBreakeven = Math.max(0, breakevenUnits - currentUnits);

  // Safety margin (how far current units exceed breakeven)
  const safetyMargin =
    currentUnits > breakevenUnits ? ((currentUnits - breakevenUnits) / currentUnits) * 100 : 0;

  return {
    breakevenUnits,
    breakevenRevenue: Math.round(breakevenRevenue * 100) / 100,
    currentProfit: Math.round(currentProfit * 100) / 100,
    gapToBreakeven,
    monthsToBreakeven: gapToBreakeven > 0 && currentUnits > 0 ? Math.ceil(gapToBreakeven / currentUnits) : 0,
    safetyMargin: Math.round(safetyMargin * 10) / 10,
  };
}

/**
 * Main unit economics analysis function
 */
export function analyzeUnitEconomics(input: UnitEconomicsInput): UnitEconomicsResult {
  const {
    companyId,
    arpu,
    churnRate,
    grossMarginPercent,
    cac,
    fixedCosts,
    variableCostPerUnit,
    currentCustomers,
  } = input;

  // Calculate LTV
  const ltv = calculateLTV(
    {
      arpu,
      grossMarginPercent,
      churnRate,
    },
    cac
  );

  // Calculate CAC payback (simulate spend for 1 month of customers)
  const cacPayback = calculateCACPayback({
    totalSpend: cac * currentCustomers * 0.1, // Assume 10% of base acquired monthly
    newCustomers: Math.max(1, Math.floor(currentCustomers * 0.1)),
    arpu,
    grossMarginPercent,
  });

  // Override CAC with provided value
  cacPayback.cac = cac;

  // Calculate gross margin (simplified)
  const monthlyRevenue = arpu * currentCustomers;
  const monthlyCOGS = monthlyRevenue * (1 - grossMarginPercent / 100);
  const grossMargin = optimizeGrossMargin({
    revenue: monthlyRevenue,
    cogs: monthlyCOGS,
    variableCosts: monthlyCOGS * 0.3,
    fixedCosts,
  });

  // Override current margin with provided
  grossMargin.currentMargin = grossMarginPercent;

  // Calculate breakeven
  const breakeven = analyzeBreakeven({
    fixedCosts,
    variableCostPerUnit,
    pricePerUnit: arpu,
    currentUnits: currentCustomers,
  });

  // Determine overall health
  const ltvToCacRatio = ltv.ltvToCacRatio || 1;
  const { ltvToCac, cacPayback: cacPaybackThresholds, grossMargin: marginThresholds } = HEALTH_THRESHOLDS;

  let healthScore = 0;
  if (ltvToCacRatio >= ltvToCac.excellent) healthScore += 3;
  else if (ltvToCacRatio >= ltvToCac.good) healthScore += 2;
  else if (ltvToCacRatio >= ltvToCac.warning) healthScore += 1;

  if (cacPayback.paybackMonths <= cacPaybackThresholds.excellent) healthScore += 3;
  else if (cacPayback.paybackMonths <= cacPaybackThresholds.good) healthScore += 2;
  else if (cacPayback.paybackMonths <= cacPaybackThresholds.warning) healthScore += 1;

  if (grossMarginPercent >= marginThresholds.excellent) healthScore += 3;
  else if (grossMarginPercent >= marginThresholds.good) healthScore += 2;
  else if (grossMarginPercent >= marginThresholds.warning) healthScore += 1;

  let overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  if (healthScore >= 8) overallHealth = 'excellent';
  else if (healthScore >= 6) overallHealth = 'good';
  else if (healthScore >= 4) overallHealth = 'warning';
  else overallHealth = 'critical';

  // Generate recommendations
  const recommendations: string[] = [];

  if (ltvToCacRatio < 3) {
    recommendations.push(`Increase LTV:CAC ratio from ${ltvToCacRatio.toFixed(1)} to 3+ (reduce CAC or increase LTV)`);
  }

  if (cacPayback.paybackMonths > 12) {
    recommendations.push(`Reduce CAC payback from ${cacPayback.paybackMonths} to <12 months`);
  }

  if (grossMarginPercent < 70) {
    recommendations.push(`Improve gross margin from ${grossMarginPercent}% to 70%+`);
  }

  if (breakeven.gapToBreakeven > 0) {
    recommendations.push(`Add ${breakeven.gapToBreakeven} customers to reach breakeven`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Unit economics are healthy - focus on scaling');
  }

  return {
    analyzedAt: new Date(),
    companyId,
    ltv,
    cacPayback,
    grossMargin,
    breakeven,
    overallHealth,
    keyMetrics: {
      ltvToCacRatio: Math.round(ltvToCacRatio * 10) / 10,
      cacPaybackMonths: cacPayback.paybackMonths,
      grossMarginPercent,
    },
    recommendations,
  };
}

/**
 * Sample data for testing and demonstration
 */
export const SAMPLE_DATA = {
  healthyStartup: {
    companyId: 'startup-001',
    arpu: 299,
    churnRate: 0.05,
    grossMarginPercent: 75,
    cac: 450,
    fixedCosts: 50000,
    variableCostPerUnit: 75,
    currentCustomers: 500,
  } as UnitEconomicsInput,

  strugglingStartup: {
    companyId: 'startup-002',
    arpu: 99,
    churnRate: 0.15,
    grossMarginPercent: 45,
    cac: 350,
    fixedCosts: 80000,
    variableCostPerUnit: 55,
    currentCustomers: 200,
  } as UnitEconomicsInput,

  enterpriseSaaS: {
    companyId: 'enterprise-001',
    arpu: 2500,
    churnRate: 0.02,
    grossMarginPercent: 85,
    cac: 15000,
    fixedCosts: 500000,
    variableCostPerUnit: 375,
    currentCustomers: 150,
  } as UnitEconomicsInput,
};

export default {
  analyzeUnitEconomics,
  calculateLTV,
  calculateCACPayback,
  optimizeGrossMargin,
  analyzeBreakeven,
  HEALTH_THRESHOLDS,
  SAMPLE_DATA,
};
