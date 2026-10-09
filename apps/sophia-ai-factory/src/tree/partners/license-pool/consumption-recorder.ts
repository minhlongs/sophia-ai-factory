/**
 * MCU Consumption Recording and Auto-Topup Logic
 *
 * Layer: tree (domain business logic & D1 operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/license-pool/consumption-recorder
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerLicensePool,
  RecordMcuConsumptionResult,
} from '@/tree/partners/types';

/**
 * Records MCU consumption for a subaccount drawing from a license pool.
 * Enforces atomic consumption limits and evaluates auto-topup threshold.
 *
 * @param db - D1Database instance.
 * @param poolId - ID of the license pool.
 * @param subaccountId - Subaccount executing compute.
 * @param mcuConsumed - Amount of MCU compute consumed (>= 1).
 */
export async function recordMcuConsumption(
  db: D1Database,
  poolId: string,
  subaccountId: string,
  mcuConsumed: number,
): Promise<RecordMcuConsumptionResult> {
  if (mcuConsumed <= 0 || !Number.isInteger(mcuConsumed)) {
    return {
      success: false,
      poolId,
      subaccountId,
      mcuConsumed: 0,
      totalConsumedMcu: 0,
      remainingAllocatedMcu: 0,
      thresholdTriggered: false,
      autoTopupExecuted: false,
      error: 'INVALID_CONSUMPTION_AMOUNT',
    };
  }

  const now = Date.now();

  // Atomic CAS query: Cannot consume more MCU than allocated
  const updateResult = await db
    .prepare(`
      UPDATE partner_license_pools
      SET consumed_mcu_credits = consumed_mcu_credits + ?1,
          updated_at = ?2
      WHERE id = ?3
        AND status = 'active'
        AND (allocated_mcu_credits - consumed_mcu_credits) >= ?1
    `)
    .bind(mcuConsumed, now, poolId)
    .run();

  const changes = updateResult.meta?.changes ?? 0;

  if (changes === 0) {
    return await handleConsumptionFailure(db, poolId, subaccountId, mcuConsumed);
  }

  // Fetch updated pool state
  const pool = await db
    .prepare('SELECT * FROM partner_license_pools WHERE id = ?')
    .bind(poolId)
    .first<PartnerLicensePool>();

  if (!pool) {
    throw new Error(`License pool missing after successful CAS update: ${poolId}`);
  }

  let remainingAllocatedMcu = pool.allocated_mcu_credits - pool.consumed_mcu_credits;
  const unallocatedMcu = pool.total_mcu_credits - pool.allocated_mcu_credits;

  // Threshold Check: Is remaining allocated MCU <= auto_topup_threshold_mcu?
  const thresholdTriggered =
    pool.auto_topup_enabled === 1 &&
    pool.auto_topup_threshold_mcu > 0 &&
    remainingAllocatedMcu <= pool.auto_topup_threshold_mcu;

  let autoTopupExecuted = false;

  // Auto-Topup Execution: If triggered and pool has unallocated capacity
  if (thresholdTriggered && pool.auto_topup_amount_mcu > 0 && unallocatedMcu >= pool.auto_topup_amount_mcu) {
    const topupResult = await db
      .prepare(`
        UPDATE partner_license_pools
        SET allocated_mcu_credits = allocated_mcu_credits + ?1,
            updated_at = ?2
        WHERE id = ?3
          AND status = 'active'
          AND (total_mcu_credits - allocated_mcu_credits) >= ?1
      `)
      .bind(pool.auto_topup_amount_mcu, Date.now(), poolId)
      .run();

    if ((topupResult.meta?.changes ?? 0) > 0) {
      autoTopupExecuted = true;
      remainingAllocatedMcu += pool.auto_topup_amount_mcu;
    }
  }

  // Optional: Update subaccount_mcu_allocations used_mcu
  try {
    await db
      .prepare('UPDATE subaccount_mcu_allocations SET used_mcu = used_mcu + ?1, updated_at = ?2 WHERE subaccount_id = ?3')
      .bind(mcuConsumed, now, subaccountId)
      .run();
  } catch {
    // Non-fatal if table not present
  }

  return {
    success: true,
    poolId,
    subaccountId,
    mcuConsumed,
    totalConsumedMcu: pool.consumed_mcu_credits,
    remainingAllocatedMcu,
    thresholdTriggered,
    autoTopupExecuted,
  };
}

async function handleConsumptionFailure(
  db: D1Database,
  poolId: string,
  subaccountId: string,
  mcuConsumed: number,
): Promise<RecordMcuConsumptionResult> {
  const pool = await db
    .prepare('SELECT id, status, allocated_mcu_credits, consumed_mcu_credits FROM partner_license_pools WHERE id = ?')
    .bind(poolId)
    .first<PartnerLicensePool>();

  if (!pool) {
    return {
      success: false,
      poolId,
      subaccountId,
      mcuConsumed,
      totalConsumedMcu: 0,
      remainingAllocatedMcu: 0,
      thresholdTriggered: false,
      autoTopupExecuted: false,
      error: 'POOL_NOT_FOUND',
    };
  }

  if (pool.status !== 'active') {
    return {
      success: false,
      poolId,
      subaccountId,
      mcuConsumed,
      totalConsumedMcu: pool.consumed_mcu_credits,
      remainingAllocatedMcu: pool.allocated_mcu_credits - pool.consumed_mcu_credits,
      thresholdTriggered: false,
      autoTopupExecuted: false,
      error: 'POOL_NOT_ACTIVE',
    };
  }

  return {
    success: false,
    poolId,
    subaccountId,
    mcuConsumed,
    totalConsumedMcu: pool.consumed_mcu_credits,
    remainingAllocatedMcu: pool.allocated_mcu_credits - pool.consumed_mcu_credits,
    thresholdTriggered: false,
    autoTopupExecuted: false,
    error: 'INSUFFICIENT_ALLOCATED_MCU',
  };
}
