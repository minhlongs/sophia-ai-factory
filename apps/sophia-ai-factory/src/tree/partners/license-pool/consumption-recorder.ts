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
import {
  handleConsumptionFailure,
  evaluateAndExecuteAutoTopup,
} from './consumption-recorder-helpers';

export { handleConsumptionFailure, evaluateAndExecuteAutoTopup };

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

  const { remainingAllocatedMcu, thresholdTriggered, autoTopupExecuted } =
    await evaluateAndExecuteAutoTopup(db, pool);

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
