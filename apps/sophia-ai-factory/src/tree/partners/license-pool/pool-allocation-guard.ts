/**
 * License Pool Allocation Failure Guard & Reason Diagnostics
 *
 * Layer: tree (domain business logic & D1 operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/license-pool/pool-allocation-guard
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerLicensePool,
  AllocateLicensePoolResult,
} from '@/tree/partners/types';

/**
 * Diagnoses why a CAS license pool quota update failed and produces detailed error result.
 */
export async function diagnoseAllocationFailure(
  db: D1Database,
  poolId: string,
  subaccountId: string,
  seats: number,
  mcuCredits: number,
): Promise<AllocateLicensePoolResult> {
  const pool = await db
    .prepare('SELECT id, status, total_seats, allocated_seats, total_mcu_credits, allocated_mcu_credits FROM partner_license_pools WHERE id = ?')
    .bind(poolId)
    .first<PartnerLicensePool>();

  if (!pool) {
    return {
      success: false,
      poolId,
      subaccountId,
      allocatedSeats: 0,
      allocatedMcuCredits: 0,
      remainingPoolSeats: 0,
      remainingPoolMcu: 0,
      error: 'POOL_NOT_FOUND',
    };
  }

  if (pool.status !== 'active') {
    return {
      success: false,
      poolId,
      subaccountId,
      allocatedSeats: 0,
      allocatedMcuCredits: 0,
      remainingPoolSeats: 0,
      remainingPoolMcu: 0,
      error: pool.status === 'exhausted' ? 'POOL_EXHAUSTED' : 'POOL_NOT_ACTIVE',
    };
  }

  const remainingSeats = pool.total_seats - pool.allocated_seats;
  const remainingMcu = pool.total_mcu_credits - pool.allocated_mcu_credits;

  if (remainingSeats < seats) {
    return {
      success: false,
      poolId,
      subaccountId,
      allocatedSeats: 0,
      allocatedMcuCredits: 0,
      remainingPoolSeats: remainingSeats,
      remainingPoolMcu: remainingMcu,
      error: 'INSUFFICIENT_POOL_SEATS',
    };
  }

  if (remainingMcu < mcuCredits) {
    return {
      success: false,
      poolId,
      subaccountId,
      allocatedSeats: 0,
      allocatedMcuCredits: 0,
      remainingPoolSeats: remainingSeats,
      remainingPoolMcu: remainingMcu,
      error: 'INSUFFICIENT_POOL_MCU',
    };
  }

  return {
    success: false,
    poolId,
    subaccountId,
    allocatedSeats: 0,
    allocatedMcuCredits: 0,
    remainingPoolSeats: remainingSeats,
    remainingPoolMcu: remainingMcu,
    error: 'INSUFFICIENT_POOL_CAPACITY',
  };
}
