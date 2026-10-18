/**
 * License Pool Quota Allocation Logic
 *
 * Layer: tree (domain business logic & D1 operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/license-pool/pool-allocator
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AllocateLicensePoolResult } from '@/tree/partners/types';
import { diagnoseAllocationFailure } from './pool-allocation-guard';
import {
  validatePoolAllocationInput,
  syncPoolExhaustionAndSubaccountMcu,
} from './pool-allocation-sync';

/**
 * Allocates seats and MCU quota from a partner license pool to a client subaccount.
 * Uses atomic Compare-And-Swap (CAS) query to guarantee concurrency safety and zero overdraft.
 *
 * @param db - D1Database instance.
 * @param poolId - ID of the license pool.
 * @param subaccountId - Subaccount recipient identifier.
 * @param seats - Number of seats to allocate (>= 0).
 * @param mcuCredits - Model Compute Units to allocate (>= 0).
 */
export async function allocatePoolQuota(
  db: D1Database,
  poolId: string,
  subaccountId: string,
  seats: number,
  mcuCredits: number,
): Promise<AllocateLicensePoolResult> {
  const validationError = validatePoolAllocationInput(poolId, subaccountId, seats, mcuCredits);
  if (validationError) {
    return validationError;
  }

  const now = Date.now();

  // Atomic Compare-And-Swap (CAS) update
  const updateResult = await db
    .prepare(`
      UPDATE partner_license_pools
      SET allocated_seats = allocated_seats + ?1,
          allocated_mcu_credits = allocated_mcu_credits + ?2,
          updated_at = ?3
      WHERE id = ?4
        AND status = 'active'
        AND (total_seats - allocated_seats) >= ?1
        AND (total_mcu_credits - allocated_mcu_credits) >= ?2
    `)
    .bind(seats, mcuCredits, now, poolId)
    .run();

  const changes = updateResult.meta?.changes ?? 0;

  if (changes === 0) {
    return await diagnoseAllocationFailure(db, poolId, subaccountId, seats, mcuCredits);
  }

  const { remainingPoolSeats, remainingPoolMcu } = await syncPoolExhaustionAndSubaccountMcu(
    db,
    poolId,
    subaccountId,
    mcuCredits,
    now,
  );

  return {
    success: true,
    poolId,
    subaccountId,
    allocatedSeats: seats,
    allocatedMcuCredits: mcuCredits,
    remainingPoolSeats,
    remainingPoolMcu,
  };
}
