/**
 * Validation and row construction helpers for License Pool creation
 *
 * Layer: tree (domain business logic & D1 operations)
 *
 * @module tree/partners/license-pool/pool-creator-helpers
 */

import type { PartnerLicensePool } from '@/tree/partners/types';

export interface CreateLicensePoolOptions {
  autoTopupEnabled?: boolean;
  autoTopupThresholdMcu?: number;
  autoTopupAmountMcu?: number;
  periodStart?: number;
  periodEnd?: number;
  autoRenew?: boolean;
}

export function validateCreatePoolInputs(
  poolName: string,
  seats: number,
  mcuCredits: number,
  unitPriceCents: number
): string | null {
  const trimmedName = poolName?.trim();
  if (!trimmedName || trimmedName.length < 2) {
    return 'INVALID_POOL_NAME';
  }
  if (seats <= 0 || !Number.isInteger(seats)) {
    return 'INVALID_SEATS_COUNT';
  }
  if (mcuCredits <= 0 || !Number.isInteger(mcuCredits)) {
    return 'INVALID_MCU_CREDITS';
  }
  if (unitPriceCents < 0 || !Number.isInteger(unitPriceCents)) {
    return 'INVALID_UNIT_PRICE';
  }
  return null;
}

export function buildLicensePoolRecord(params: {
  poolId: string;
  partnerId: string;
  trimmedName: string;
  seats: number;
  mcuCredits: number;
  unitPriceCents: number;
  options?: CreateLicensePoolOptions;
  now: number;
}): PartnerLicensePool {
  const {
    poolId,
    partnerId,
    trimmedName,
    seats,
    mcuCredits,
    unitPriceCents,
    options,
    now,
  } = params;

  return {
    id: poolId,
    partner_id: partnerId,
    pool_name: trimmedName,
    total_seats: seats,
    allocated_seats: 0,
    total_mcu_credits: mcuCredits,
    allocated_mcu_credits: 0,
    consumed_mcu_credits: 0,
    unit_price_cents: unitPriceCents,
    auto_topup_enabled: options?.autoTopupEnabled ? 1 : 0,
    auto_topup_threshold_mcu: options?.autoTopupThresholdMcu ?? 0,
    auto_topup_amount_mcu: options?.autoTopupAmountMcu ?? 0,
    period_start: options?.periodStart ?? null,
    period_end: options?.periodEnd ?? null,
    auto_renew: options?.autoRenew ? 1 : 0,
    status: 'active',
    created_at: now,
    updated_at: now,
  };
}
