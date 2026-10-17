/**
 * MCU Consumption Failure & Auto-Topup Helper Operations
 *
 * Layer: tree (domain business logic & D1 operations)
 *
 * @module tree/partners/license-pool/consumption-recorder-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerLicensePool,
  RecordMcuConsumptionResult,
} from '@/tree/partners/types';

export async function handleConsumptionFailure(
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

export async function evaluateAndExecuteAutoTopup(
  db: D1Database,
  pool: PartnerLicensePool,
): Promise<{
  remainingAllocatedMcu: number;
  thresholdTriggered: boolean;
  autoTopupExecuted: boolean;
}> {
  let remainingAllocatedMcu = pool.allocated_mcu_credits - pool.consumed_mcu_credits;
  const unallocatedMcu = pool.total_mcu_credits - pool.allocated_mcu_credits;

  const thresholdTriggered =
    pool.auto_topup_enabled === 1 &&
    pool.auto_topup_threshold_mcu > 0 &&
    remainingAllocatedMcu <= pool.auto_topup_threshold_mcu;

  let autoTopupExecuted = false;

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
      .bind(pool.auto_topup_amount_mcu, Date.now(), pool.id)
      .run();

    if ((topupResult.meta?.changes ?? 0) > 0) {
      autoTopupExecuted = true;
      remainingAllocatedMcu += pool.auto_topup_amount_mcu;
    }
  }

  return { remainingAllocatedMcu, thresholdTriggered, autoTopupExecuted };
}
