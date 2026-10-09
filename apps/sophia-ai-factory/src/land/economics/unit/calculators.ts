/**
 * Unit Economics Submodule: Pure Financial Calculators.
 * Layer: land (Domain service)
 *
 * @module land/economics/unit/calculators
 */

/**
 * Computes gross margin percentage: ((Revenue - COGS) / Revenue) * 100 clamped to [-100, 100].
 */
export function calculateGrossMarginPct(totalRevenueUsd: number, totalCogsUsd: number): number {
  if (totalRevenueUsd <= 0) return 0;
  const margin = ((totalRevenueUsd - totalCogsUsd) / totalRevenueUsd) * 100;
  return Number(Math.min(100, Math.max(-100, margin)).toFixed(1));
}

/**
 * Computes cost of goods sold per video published to 4 decimal places.
 */
export function calculateCogsPerVideo(totalVideoCogsUsd: number, totalVideosCompleted: number): number {
  if (totalVideosCompleted <= 0) return 0;
  return Number((totalVideoCogsUsd / totalVideosCompleted).toFixed(4));
}

export interface CalculateLtvCacParams {
  arpuUsd: number;
  grossMarginPct: number;
  monthlyChurnPct: number;
  totalAcquisitionSpendUsd: number;
  acquiredCustomersCount: number;
}

export interface CalculateLtvCacResult {
  ltvUsd: number;
  cacUsd: number;
  ltvCacRatio: number;
  paybackMonths: number;
}

/**
 * Computes customer lifetime value (LTV), acquisition cost (CAC), LTV:CAC ratio and payback period.
 */
export function calculateLtvCac(params: CalculateLtvCacParams): CalculateLtvCacResult {
  const {
    arpuUsd,
    grossMarginPct,
    monthlyChurnPct,
    totalAcquisitionSpendUsd,
    acquiredCustomersCount,
  } = params;

  const marginDecimal = Math.max(0, grossMarginPct / 100);
  const churnDecimal = Math.max(0.01, monthlyChurnPct / 100); // 1% min churn guard

  // LTV = (ARPU * Gross Margin) / Churn
  const ltvUsd = Number(((arpuUsd * marginDecimal) / churnDecimal).toFixed(2));

  // CAC = Total Acquisition Spend / Acquired Customers
  const cacUsd = Number(
    (totalAcquisitionSpendUsd / Math.max(1, acquiredCustomersCount)).toFixed(2)
  );

  // LTV:CAC Ratio
  const ltvCacRatio = Number((ltvUsd / Math.max(1, cacUsd)).toFixed(2));

  // Payback period in months: CAC / (ARPU * Gross Margin)
  const monthlyContribution = arpuUsd * marginDecimal;
  const paybackMonths =
    monthlyContribution > 0 ? Number((cacUsd / monthlyContribution).toFixed(1)) : 0;

  return { ltvUsd, cacUsd, ltvCacRatio, paybackMonths };
}
