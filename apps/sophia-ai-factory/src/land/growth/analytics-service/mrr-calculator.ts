/**
 * MRR Milestone Progress & Financial Telemetry Calculator
 *
 * Layer: Land (Domain service & data aggregation, imports seed only)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module land/growth/analytics-service/mrr-calculator
 */

import type { MrrMilestoneProgress, MrrTierBreakdown } from '@/seed/types/solutions-types';
import { TARGET_MRR_USD, TARGET_PAYING_CUSTOMERS, type CalculateMrrProgressInput } from './types';

/**
 * Pure helper to compute MRR milestone progress and ARPU.
 */
export function calculateMrrProgress(params: CalculateMrrProgressInput): MrrMilestoneProgress {
  const { basic, premium, enterprise, master } = params.tierCounts;

  const basicMrr = basic * 199;
  const premiumMrr = premium * 399;
  const enterpriseMrr = enterprise * 799;
  const masterRevenue = master * 4999;

  const calculatedMrr = params.customMrr ?? basicMrr + premiumMrr + enterpriseMrr;
  const payingCustomers = basic + premium + enterprise + master;

  const progressPct = Number(Math.min(100, (calculatedMrr / TARGET_MRR_USD) * 100).toFixed(1));
  const gapToTargetUsd = Math.max(0, TARGET_MRR_USD - calculatedMrr);

  const customerProgressPct = Number(
    Math.min(100, (payingCustomers / TARGET_PAYING_CUSTOMERS) * 100).toFixed(1),
  );
  const customerGap = Math.max(0, TARGET_PAYING_CUSTOMERS - payingCustomers);

  const arpu = payingCustomers > 0 ? Math.round(calculatedMrr / payingCustomers) : 0;
  const runwayVelocityPct = Number(((calculatedMrr / TARGET_MRR_USD) * 100).toFixed(1));

  const tierBreakdown: MrrTierBreakdown = {
    basic: { count: basic, mrr: basicMrr },
    premium: { count: premium, mrr: premiumMrr },
    enterprise: { count: enterprise, mrr: enterpriseMrr },
    master: { count: master, revenue: masterRevenue },
  };

  return {
    targetMrrUsd: TARGET_MRR_USD,
    currentMrrUsd: calculatedMrr,
    progressPct,
    gapToTargetUsd,
    targetPayingCustomers: TARGET_PAYING_CUSTOMERS,
    currentPayingCustomers: payingCustomers,
    customerProgressPct,
    customerGap,
    arpu,
    runwayVelocityPct,
    tierBreakdown,
  };
}
