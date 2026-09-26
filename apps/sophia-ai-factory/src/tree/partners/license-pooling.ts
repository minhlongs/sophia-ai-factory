/**
 * Bulk License & MCU Quota Pooling Domain Service
 *
 * Layer: tree (domain business logic, math models & D1 database operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * Invariants:
 * 1. Atomic Compare-And-Swap (CAS): Guaranteed prevention of double-allocation or overdraft.
 * 2. Capacity Guardrails: (total_seats - allocated_seats) >= seats AND (total_mcu - allocated_mcu) >= mcu.
 * 3. Threshold Awareness: Triggers auto-topup when remaining MCU drops below auto_topup_threshold_mcu.
 *
 * @module tree/partners/license-pooling
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerProfile,
  PartnerLicensePool,
  CreateLicensePoolInput,
  CreateLicensePoolResult,
  AllocateLicensePoolInput,
  AllocateLicensePoolResult,
  RecordMcuConsumptionInput,
  RecordMcuConsumptionResult,
} from '@/tree/partners/types';

/**
 * Creates a new bulk license and MCU quota pool for a partner agency.
 *
 * @param db - D1Database instance.
 * @param partnerId - ID of the partner profile owning this pool.
 * @param poolName - Descriptive name of the pool (e.g. "APAC Enterprise Q3 Pool").
 * @param seats - Total client seats provisioned.
 * @param mcuCredits - Total Model Compute Unit credits provisioned.
 * @param unitPriceCents - Cost basis in cents per unit.
 * @param options - Additional options including auto-topup and period constraints.
 */
export async function createLicensePool(
  db: D1Database,
  partnerId: string,
  poolName: string,
  seats: number,
  mcuCredits: number,
  unitPriceCents: number,
  options?: {
    autoTopupEnabled?: boolean;
    autoTopupThresholdMcu?: number;
    autoTopupAmountMcu?: number;
    periodStart?: number;
    periodEnd?: number;
    autoRenew?: boolean;
  },
): Promise<CreateLicensePoolResult> {
  const trimmedName = poolName?.trim();
  if (!trimmedName || trimmedName.length < 2) {
    return { success: false, error: 'INVALID_POOL_NAME' };
  }

  if (seats <= 0 || !Number.isInteger(seats)) {
    return { success: false, error: 'INVALID_SEATS_COUNT' };
  }

  if (mcuCredits <= 0 || !Number.isInteger(mcuCredits)) {
    return { success: false, error: 'INVALID_MCU_CREDITS' };
  }

  if (unitPriceCents < 0 || !Number.isInteger(unitPriceCents)) {
    return { success: false, error: 'INVALID_UNIT_PRICE' };
  }

  // Verify partner exists and is active
  const partner = await db
    .prepare('SELECT id, status FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerProfile>();

  if (!partner) {
    return { success: false, error: 'PARTNER_NOT_FOUND' };
  }

  if (partner.status !== 'active') {
    return {
      success: false,
      error: partner.status === 'suspended' ? 'PARTNER_SUSPENDED' : 'PARTNER_NOT_ACTIVE',
    };
  }

  const poolId = `pool_${crypto.randomUUID().slice(0, 16)}`;
  const now = Date.now();
  const autoTopupEnabled = options?.autoTopupEnabled ? 1 : 0;
  const autoTopupThresholdMcu = options?.autoTopupThresholdMcu ?? 0;
  const autoTopupAmountMcu = options?.autoTopupAmountMcu ?? 0;
  const periodStart = options?.periodStart ?? null;
  const periodEnd = options?.periodEnd ?? null;
  const autoRenew = options?.autoRenew ? 1 : 0;

  const result = await db
    .prepare(`
      INSERT INTO partner_license_pools (
        id,
        partner_id,
        pool_name,
        total_seats,
        allocated_seats,
        total_mcu_credits,
        allocated_mcu_credits,
        consumed_mcu_credits,
        unit_price_cents,
        auto_topup_enabled,
        auto_topup_threshold_mcu,
        auto_topup_amount_mcu,
        period_start,
        period_end,
        auto_renew,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 0, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `)
    .bind(
      poolId,
      partnerId,
      trimmedName,
      seats,
      mcuCredits,
      unitPriceCents,
      autoTopupEnabled,
      autoTopupThresholdMcu,
      autoTopupAmountMcu,
      periodStart,
      periodEnd,
      autoRenew,
      now,
      now,
    )
    .run();

  if (!result.success) {
    return { success: false, error: 'DATABASE_INSERT_FAILED' };
  }

  const createdPool: PartnerLicensePool = {
    id: poolId,
    partner_id: partnerId,
    pool_name: trimmedName,
    total_seats: seats,
    allocated_seats: 0,
    total_mcu_credits: mcuCredits,
    allocated_mcu_credits: 0,
    consumed_mcu_credits: 0,
    unit_price_cents: unitPriceCents,
    auto_topup_enabled: autoTopupEnabled,
    auto_topup_threshold_mcu: autoTopupThresholdMcu,
    auto_topup_amount_mcu: autoTopupAmountMcu,
    period_start: periodStart,
    period_end: periodEnd,
    auto_renew: autoRenew,
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  return { success: true, pool: createdPool };
}

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
    // Investigate failure reason
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

/**
 * Retrieves a license pool by ID.
 */
export async function getLicensePoolById(
  db: D1Database,
  poolId: string,
): Promise<PartnerLicensePool | null> {
  return await db
    .prepare('SELECT * FROM partner_license_pools WHERE id = ?')
    .bind(poolId)
    .first<PartnerLicensePool>();
}

/**
 * Retrieves all license pools for a given partner.
 */
export async function getPartnerLicensePools(
  db: D1Database,
  partnerId: string,
): Promise<PartnerLicensePool[]> {
  const { results } = await db
    .prepare('SELECT * FROM partner_license_pools WHERE partner_id = ? ORDER BY created_at DESC')
    .bind(partnerId)
    .all<PartnerLicensePool>();

  return results || [];
}

/**
 * De-allocates or refunds unconsumed quota back to the license pool.
 */
export async function deallocatePoolQuota(
  db: D1Database,
  poolId: string,
  subaccountId: string,
  seats: number,
  mcuCredits: number,
): Promise<{ success: boolean; remainingSeats: number; remainingMcu: number; error?: string }> {
  if (seats < 0 || mcuCredits < 0) {
    return { success: false, remainingSeats: 0, remainingMcu: 0, error: 'INVALID_AMOUNT' };
  }

  const now = Date.now();
  const res = await db
    .prepare(`
      UPDATE partner_license_pools
      SET allocated_seats = MAX(0, allocated_seats - ?1),
          allocated_mcu_credits = MAX(consumed_mcu_credits, allocated_mcu_credits - ?2),
          updated_at = ?3
      WHERE id = ?4 AND status IN ('active', 'exhausted')
    `)
    .bind(seats, mcuCredits, now, poolId)
    .run();

  if ((res.meta?.changes ?? 0) === 0) {
    return { success: false, remainingSeats: 0, remainingMcu: 0, error: 'POOL_NOT_FOUND' };
  }

  // Restore pool to active if it was exhausted
  await db
    .prepare("UPDATE partner_license_pools SET status = 'active' WHERE id = ? AND status = 'exhausted'")
    .bind(poolId)
    .run();

  const pool = await getLicensePoolById(db, poolId);
  return {
    success: true,
    remainingSeats: (pool?.total_seats ?? 0) - (pool?.allocated_seats ?? 0),
    remainingMcu: (pool?.total_mcu_credits ?? 0) - (pool?.allocated_mcu_credits ?? 0),
  };
}
