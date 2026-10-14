/**
 * Agency Revenue Attribution & Client Quota Analytics Engine
 *
 * Layer: tree (Pure domain logic — zero DB, zero network side effects)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * Responsibilities:
 * 1. calculateMcuUtilization: Computes percentage, remaining balance, and over-quota flags
 * 2. calculateAttributedMrr: Resolves subscription tier value or custom MRR
 * 3. calculateGrossMargin: Computes profit and margin percentage based on wholesale MCU cost
 * 4. determineVelocityAlert: Evaluates consumption velocity and quota burn risk
 * 5. buildRevenueAttribution: Generates detailed attribution record for a client subaccount
 * 6. aggregateAgencyKpis: Aggregates client-wide portfolio metrics into high-level KPI cards
 *
 * @module tree/agency/attribution-engine
 */

import type { VelocityAlertStatus } from '@/seed/types';

export {
  buildRevenueAttribution,
  aggregateAgencyKpis,
} from './attribution-portfolio';

export const STANDARD_TIER_MRR: Record<string, number> = {
  starter: 99,
  growth: 299,
  scale: 599,
  enterprise: 999,
};

export const DEFAULT_MCU_WHOLESALE_COST_USD = 0.05; // $0.05 per MCU wholesale GPU compute cost

export interface McuUtilizationResult {
  allocated: number;
  used: number;
  remaining: number;
  usedRatePercent: number;
  isOverQuota: boolean;
}

/**
 * Calculates MCU quota utilization metrics safely without division-by-zero risks.
 */
export function calculateMcuUtilization(allocated: number, used: number): McuUtilizationResult {
  const safeAllocated = Number.isFinite(allocated) && allocated > 0 ? allocated : 0;
  const safeUsed = Number.isFinite(used) && used >= 0 ? used : 0;

  if (safeAllocated === 0) {
    return {
      allocated: 0,
      used: safeUsed,
      remaining: 0,
      usedRatePercent: safeUsed > 0 ? 100 : 0,
      isOverQuota: safeUsed > 0,
    };
  }

  const remaining = Math.max(0, safeAllocated - safeUsed);
  const rawRatio = (safeUsed / safeAllocated) * 100;
  const usedRatePercent = Math.min(100, Math.round(rawRatio * 10) / 10);
  const isOverQuota = safeUsed > safeAllocated;

  return {
    allocated: safeAllocated,
    used: safeUsed,
    remaining,
    usedRatePercent,
    isOverQuota,
  };
}

/**
 * Resolves monthly recurring revenue for a client tier.
 */
export function resolveTierMrr(tierName: string | null | undefined, customMrr?: number): number {
  if (typeof customMrr === 'number' && Number.isFinite(customMrr) && customMrr > 0) {
    return customMrr;
  }
  if (!tierName || typeof tierName !== 'string') {
    return STANDARD_TIER_MRR.starter;
  }
  const normalized = tierName.trim().toLowerCase();
  return STANDARD_TIER_MRR[normalized] ?? STANDARD_TIER_MRR.starter;
}

/**
 * Calculates gross margin percentage based on MRR and GPU compute costs.
 */
export function calculateGrossMargin(
  mrrUsd: number,
  mcuConsumed: number,
  costPerMcu = DEFAULT_MCU_WHOLESALE_COST_USD
): { computeCostUsd: number; grossProfitUsd: number; marginPercent: number } {
  const safeMrr = Number.isFinite(mrrUsd) && mrrUsd > 0 ? mrrUsd : 0;
  const safeMcu = Number.isFinite(mcuConsumed) && mcuConsumed > 0 ? mcuConsumed : 0;
  const safeUnitCost = Number.isFinite(costPerMcu) && costPerMcu > 0 ? costPerMcu : DEFAULT_MCU_WHOLESALE_COST_USD;

  const computeCostUsd = Math.round(safeMcu * safeUnitCost * 100) / 100;
  const grossProfitUsd = Math.round((safeMrr - computeCostUsd) * 100) / 100;

  if (safeMrr === 0) {
    return { computeCostUsd, grossProfitUsd, marginPercent: 0 };
  }

  const rawMargin = (grossProfitUsd / safeMrr) * 100;
  const marginPercent = Math.round(rawMargin * 10) / 10;

  return { computeCostUsd, grossProfitUsd, marginPercent };
}

/**
 * Determines quota consumption velocity alert level.
 */
export function determineVelocityAlert(allocated: number, used: number): VelocityAlertStatus {
  const safeAllocated = Number.isFinite(allocated) && allocated > 0 ? allocated : 0;
  const safeUsed = Number.isFinite(used) && used >= 0 ? used : 0;

  if (safeAllocated === 0) {
    return safeUsed > 0 ? 'exceeded' : 'normal';
  }

  const ratio = safeUsed / safeAllocated;
  if (ratio >= 1.0) {
    return 'exceeded';
  }
  if (ratio >= 0.8) {
    return 'near_limit';
  }
  return 'normal';
}
