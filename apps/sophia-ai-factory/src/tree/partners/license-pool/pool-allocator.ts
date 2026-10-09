/**
 * License Pool Quota Allocation Logic
 *
 * Layer: tree (domain business logic & D1 operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/license-pool/pool-allocator
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerLicensePool,
  AllocateLicensePoolResult,
} from '@/tree/partners/types';
import { diagnoseAllocationFailure } from './pool-allocation-guard';

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
  if (!poolId || !subaccountId) {
    return {
      success: false,
      poolId: poolId ?? '',
      subaccountId: subaccountId ?? '',
      allocatedSeats: 0,
      allocatedMcuCredits: 0,
      remainingPoolSeats: 0,
      remainingPoolMcu: 0,
      error: 'INVALID_INPUT',
    };
  }

  if (seats < 0 || !Number.isInteger(seats) || mcuCredits < 0 || !Number.isInteger(mcuCredits)) {
    return {
      success: false,
      poolId,
      subaccountId,
      allocatedSeats: 0,
      allocatedMcuCredits: 0,
      remainingPoolSeats: 0,
      remainingPoolMcu: 0,
      error: 'INVALID_ALLOCATION_AMOUNT',
    };
  }

  if (seats === 0 && mcuCredits === 0) {
    return {
      success: false,
      poolId,
      subaccountId,
      allocatedSeats: 0,
      allocatedMcuCredits: 0,
      remainingPoolSeats: 0,
      remainingPoolMcu: 0,
      error: 'NO_ALLOCATION_REQUESTED',
    };
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

  // Fetch updated pool state
  const updatedPool = await db
    .prepare('SELECT total_seats, allocated_seats, total_mcu_credits, allocated_mcu_credits FROM partner_license_pools WHERE id = ?')
    .bind(poolId)
    .first<PartnerLicensePool>();

  const remainingPoolSeats = (updatedPool?.total_seats ?? 0) - (updatedPool?.allocated_seats ?? 0);
  const remainingPoolMcu = (updatedPool?.total_mcu_credits ?? 0) - (updatedPool?.allocated_mcu_credits ?? 0);

  // If pool capacity is completely consumed, mark as exhausted
  if (remainingPoolSeats === 0 && remainingPoolMcu === 0) {
    await db
      .prepare("UPDATE partner_license_pools SET status = 'exhausted', updated_at = ? WHERE id = ?")
      .bind(now, poolId)
      .run();
  }

  // Optional: Record in subaccount_mcu_allocations if table exists
  try {
    const suballocId = `submcu_${crypto.randomUUID().slice(0, 16)}`;
    await db
      .prepare(`
        INSERT INTO subaccount_mcu_allocations (id, subaccount_id, allocated_mcu, used_mcu, created_at, updated_at)
        VALUES (?, ?, ?, 0, ?, ?)
        ON CONFLICT(subaccount_id) DO UPDATE SET
          allocated_mcu = allocated_mcu + excluded.allocated_mcu,
          updated_at = excluded.updated_at
      `)
      .bind(suballocId, subaccountId, mcuCredits, now, now)
      .run();
  } catch {
    // Non-fatal if subaccount_mcu_allocations table is not provisioned in current context
  }

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
