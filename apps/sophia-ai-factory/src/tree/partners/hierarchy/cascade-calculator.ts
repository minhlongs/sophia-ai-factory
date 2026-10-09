/**
 * Cascade Override Calculation & Zero Penny Leakage Invariants
 *
 * Layer: tree (domain business logic & math models)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/hierarchy/cascade-calculator
 */

import type { CascadeOverrideResult } from '@/tree/partners/types';

/**
 * Standard Master Agency cascade override percentage (5.0%).
 */
export const MASTER_CASCADE_OVERRIDE_RATE_PCT = 5.0;

/**
 * Calculates the 5% Cascade Override and Sub-Agency Commission with guaranteed zero penny leakage.
 *
 * Mathematical Invariants:
 * - C_master = hasActiveMaster ? floor((M * 5) / 100) : 0
 * - C_sub = floor((M * R_sub) / 100)
 * - P_net = M - C_sub - C_master
 * - C_master + C_sub + P_net == M for all M >= 0
 *
 * @param mrrCents - Gross MRR transaction amount in integer cents.
 * @param subTierRatePct - Commission rate percentage of the Sub-Agency (e.g. 20, 28, 35).
 * @param hasActiveMaster - Whether the Sub-Agency is bound to an active Master Agency.
 * @param masterPartnerId - Optional ID of the Master Agency.
 */
export function calculateCascadeOverride(
  mrrCents: number,
  subTierRatePct: number,
  hasActiveMaster: boolean,
  masterPartnerId: string | null = null,
): CascadeOverrideResult {
  if (mrrCents <= 0) {
    return {
      hasMaster: hasActiveMaster,
      masterPartnerId: hasActiveMaster ? masterPartnerId : null,
      overrideCents: 0,
      overrideRatePct: hasActiveMaster ? MASTER_CASCADE_OVERRIDE_RATE_PCT : 0,
      subPartnerCommissionCents: 0,
      subPartnerRatePct: Math.max(0, subTierRatePct),
      platformNetCents: 0,
    };
  }

  const validMrr = Math.floor(mrrCents);
  const validSubRate = Math.max(0, subTierRatePct);

  // 1. Direct Sub-Agency Commission (Floor integer cents)
  const subPartnerCommissionCents = Math.floor((validMrr * validSubRate) / 100);

  // 2. Master Agency 5% Override (Floor integer cents, 0 if no active master)
  const overrideRatePct = hasActiveMaster ? MASTER_CASCADE_OVERRIDE_RATE_PCT : 0;
  const overrideCents = hasActiveMaster
    ? Math.floor((validMrr * MASTER_CASCADE_OVERRIDE_RATE_PCT) / 100)
    : 0;

  // 3. Platform Net Retention: Exact difference guaranteeing Zero Penny Leakage
  const platformNetCents = validMrr - subPartnerCommissionCents - overrideCents;

  return {
    hasMaster: hasActiveMaster,
    masterPartnerId: hasActiveMaster ? masterPartnerId : null,
    overrideCents,
    overrideRatePct,
    subPartnerCommissionCents,
    subPartnerRatePct: validSubRate,
    platformNetCents,
  };
}
