/**
 * License Pool Post-CAS Sync & Input Validation Helpers
 *
 * Layer: tree (domain business logic & D1 operations)
 *
 * @module tree/partners/license-pool/pool-allocation-sync
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerLicensePool,
  AllocateLicensePoolResult,
} from '@/tree/partners/types';

export function validatePoolAllocationInput(
  poolId: string,
  subaccountId: string,
  seats: number,
  mcuCredits: number,
): AllocateLicensePoolResult | null {
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

  return null;
}

export async function syncPoolExhaustionAndSubaccountMcu(
  db: D1Database,
  poolId: string,
  subaccountId: string,
  mcuCredits: number,
  now: number,
): Promise<{ remainingPoolSeats: number; remainingPoolMcu: number }> {
  const updatedPool = await db
    .prepare('SELECT total_seats, allocated_seats, total_mcu_credits, allocated_mcu_credits FROM partner_license_pools WHERE id = ?')
    .bind(poolId)
    .first<PartnerLicensePool>();

  const remainingPoolSeats = (updatedPool?.total_seats ?? 0) - (updatedPool?.allocated_seats ?? 0);
  const remainingPoolMcu = (updatedPool?.total_mcu_credits ?? 0) - (updatedPool?.allocated_mcu_credits ?? 0);

  if (remainingPoolSeats === 0 && remainingPoolMcu === 0) {
    await db
      .prepare("UPDATE partner_license_pools SET status = 'exhausted', updated_at = ? WHERE id = ?")
      .bind(now, poolId)
      .run();
  }

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

  return { remainingPoolSeats, remainingPoolMcu };
}
