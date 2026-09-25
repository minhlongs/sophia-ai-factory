/**
 * Enterprise Volume Discount Calculator
 *
 * Implements tiered capacity pricing for high-volume enterprise commitments (50K–500K+ MCU/month).
 * Provides stepped volume discounts (20% to 60%) off base $0.050/MCU rate and 17% annual prepay savings.
 *
 * Layer: tree (Pure domain logic — zero I/O, deterministic)
 *
 * @module tree/contracts/volume-discount-calculator
 */

import {
  BASE_ENTERPRISE_MCU_PRICE_CENTS,
  ANNUAL_COMMITMENT_DISCOUNT_PERCENT,
  MIN_ENTERPRISE_MCU,
  VOLUME_DISCOUNT_BRACKETS,
  type VolumeDiscountBracket,
  type VolumeDiscountResult,
} from '@/seed/types/enterprise-contracts';

/**
 * Resolve the applicable volume discount bracket based on monthly MCU volume.
 *
 * @throws {Error} if mcuMonthly is less than MIN_ENTERPRISE_MCU (50,000)
 */
export function getVolumeDiscountBracket(mcuMonthly: number): VolumeDiscountBracket {
  if (!Number.isFinite(mcuMonthly) || mcuMonthly < MIN_ENTERPRISE_MCU) {
    throw new Error(
      `Invalid enterprise MCU capacity: ${mcuMonthly}. Minimum enterprise commitment is ${MIN_ENTERPRISE_MCU.toLocaleString()} MCU/month.`,
    );
  }

  const roundedMcu = Math.floor(mcuMonthly);
  for (const bracket of VOLUME_DISCOUNT_BRACKETS) {
    if (roundedMcu >= bracket.minMcu && roundedMcu <= bracket.maxMcu) {
      return bracket;
    }
  }

  // Fallback to highest tier for volumes exceeding 500k
  return VOLUME_DISCOUNT_BRACKETS[VOLUME_DISCOUNT_BRACKETS.length - 1];
}

/**
 * Calculate enterprise volume pricing and commitment totals.
 *
 * @param mcuMonthly Monthly compute capacity commitment (50,000 - 500,000+ MCU)
 * @param billingCycle Billing cadence ('monthly' or 'annual')
 */
export function calculateEnterpriseVolumeDiscount(
  mcuMonthly: number,
  billingCycle: 'monthly' | 'annual' = 'monthly',
): VolumeDiscountResult {
  const bracket = getVolumeDiscountBracket(mcuMonthly);
  const roundedMcu = Math.floor(mcuMonthly);

  // Unit price per MCU in cents
  const unitPricePerMcuCents = bracket.effectivePricePerMcuCents;

  // Monthly commitment in cents (pure integer arithmetic)
  const monthlyCommitmentCents = Math.round(roundedMcu * unitPricePerMcuCents);

  // Full 12-month value before annual discount
  const annualizedFullCents = monthlyCommitmentCents * 12;

  let annualCommitmentCents: number;
  let annualSavingsCents: number;

  if (billingCycle === 'annual') {
    annualSavingsCents = Math.round(annualizedFullCents * ANNUAL_COMMITMENT_DISCOUNT_PERCENT);
    annualCommitmentCents = annualizedFullCents - annualSavingsCents;
  } else {
    annualSavingsCents = 0;
    annualCommitmentCents = annualizedFullCents;
  }

  const effectiveRateDisplayUsd = `$${(unitPricePerMcuCents / 100).toFixed(4)}`;

  return {
    mcuCapacityMonthly: roundedMcu,
    billingCycle,
    bracket,
    unitPricePerMcuCents,
    monthlyCommitmentCents,
    annualCommitmentCents,
    annualSavingsCents,
    effectiveRateDisplayUsd,
    monthlyCommitmentUsd: monthlyCommitmentCents / 100,
    annualCommitmentUsd: annualCommitmentCents / 100,
  };
}

/**
 * Calculate the effective unit price per MCU in cents for contracted overage compute.
 * Guarantees that enterprise burst compute is billed at their contracted effective rate,
 * not the public default rate ($0.10/MCU).
 */
export function calculateOverageUnitPriceCents(mcuMonthly: number): number {
  const bracket = getVolumeDiscountBracket(mcuMonthly);
  return bracket.effectivePricePerMcuCents;
}
