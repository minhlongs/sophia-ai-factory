/**
 * ROI Metrics Types, Cost Extraction, and Projection Arithmetic
 * @module land/analytics/roi-projection
 */

export interface RaasLicenseRoiRow {
  tier: string;
  created_at: number;
  metadata: Record<string, unknown> | null;
  nonce?: string;
}

export interface UsageEventCreditRow {
  credits_used: number | null;
  created_at?: number;
}

/**
 * ROI Metrics result
 */
export interface ROIMetrics {
  projectedAnnual: number;
  actualYTD: number;
  paybackMonths: number;
  costPerUsage: number;
  roiPercent: number;      // ROI percentage: (projectedAnnual - licenseCost) / licenseCost * 100
  licenseCost: number;      // Original license cost
  totalCredits: number;     // Total credits used
}

export function extractLicenseCost(metadata: Record<string, unknown> | null): number {
  const typed = metadata as { amount_usd?: { amount: number }; price?: number } | null;
  return typed?.amount_usd?.amount || typed?.price || 0;
}

export function sumUsageCredits(events: UsageEventCreditRow[] | null): number {
  return events?.reduce((sum, e) => sum + (e.credits_used || 0), 0) || 0;
}

export function formatRoiMetrics(params: {
  projectedAnnual: number;
  actualYTD: number;
  licenseCost: number;
  totalCreditsUsed: number;
}): ROIMetrics {
  const { projectedAnnual, actualYTD, licenseCost, totalCreditsUsed } = params;
  const costPerUsage = totalCreditsUsed > 0 ? licenseCost / totalCreditsUsed : 0;
  const roiPercent =
    licenseCost > 0 ? ((projectedAnnual - licenseCost) / licenseCost) * 100 : 0;
  const paybackMonths =
    licenseCost > 0 && projectedAnnual > 0
      ? Math.ceil(licenseCost / (projectedAnnual / 12))
      : 0;

  return {
    projectedAnnual: Math.round(projectedAnnual * 100) / 100,
    actualYTD: Math.round(actualYTD * 100) / 100,
    paybackMonths: Math.max(1, paybackMonths),
    costPerUsage: Math.round(costPerUsage * 10000) / 10000,
    roiPercent: Math.round(roiPercent * 100) / 100,
    licenseCost: Math.round(licenseCost * 100) / 100,
    totalCredits: totalCreditsUsed,
  };
}
