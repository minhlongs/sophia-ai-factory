/**
 * @module land/affiliates/scout/scoring/saas-mrr-ltv-calculator
 * Calculates Recurring MRR Lifetime Value (LTV) and normalized bonus score for B2B SaaS affiliates.
 * Formula: LTV_affiliate = ARPU_monthly * CommissionRate * min(CommissionMonths, 1 / MonthlyChurnRate)
 */

import type { Affiliate } from '../types';

export interface SaasMrrLtvInput {
  monthlyArpuUsd: number;
  commissionRatePct: number;
  commissionDurationMonths: number;
  monthlyChurnRate: number; // e.g. 0.05 for 5% monthly churn
}

export interface SaasMrrLtvResult {
  expectedActiveMonths: number;
  monthlyCommissionUsd: number;
  affiliateLtvUsd: number;
  normalizedLtvScore: number; // 0..1 normalized against $600 target SaaS LTV
}

const TARGET_SAAS_LTV_USD = 600;

export function calculateSaasAffiliateMrrLtv(input: SaasMrrLtvInput): SaasMrrLtvResult {
  const safeChurn = Math.max(0.01, Math.min(input.monthlyChurnRate, 1));
  const retentionCeilingMonths = 1 / safeChurn;
  const expectedActiveMonths = Math.min(
    Math.max(1, input.commissionDurationMonths),
    retentionCeilingMonths,
  );

  const monthlyCommissionUsd = input.monthlyArpuUsd * (Math.max(0, input.commissionRatePct) / 100);
  const affiliateLtvUsd = Math.round(monthlyCommissionUsd * expectedActiveMonths * 100) / 100;
  const normalizedLtvScore = Math.min(1, Math.round((affiliateLtvUsd / TARGET_SAAS_LTV_USD) * 1000) / 1000);

  return {
    expectedActiveMonths: Math.round(expectedActiveMonths * 10) / 10,
    monthlyCommissionUsd: Math.round(monthlyCommissionUsd * 100) / 100,
    affiliateLtvUsd,
    normalizedLtvScore,
  };
}

export function computeSaasRecurringBonus(affiliate: Affiliate): number {
  const isSaas =
    affiliate.network === 'partnerstack' ||
    affiliate.network === 'awin_saas' ||
    affiliate.network === 'impact_radius' ||
    affiliate.category?.toLowerCase().includes('saas');

  if (!isSaas) return 0;

  const ltv = calculateSaasAffiliateMrrLtv({
    monthlyArpuUsd: affiliate.commissionFlatUsd && affiliate.commissionFlatUsd > 0 ? affiliate.commissionFlatUsd : 99,
    commissionRatePct: affiliate.commissionPct ?? 30,
    commissionDurationMonths: 12,
    monthlyChurnRate: 0.05,
  });

  return Math.round(ltv.normalizedLtvScore * 0.08 * 1000) / 1000;
}
