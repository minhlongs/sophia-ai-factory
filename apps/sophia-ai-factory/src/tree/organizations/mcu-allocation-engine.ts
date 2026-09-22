/**
 * Subaccount Model Compute Unit (MCU) Allocation & Quota Enforcement Engine
 *
 * Implements:
 * - Budgeting and allocating MCU quotas to client subaccounts
 * - Pre-flight quota enforcement (fail-closed if quota exceeded)
 * - Atomic deduction guard with concurrency safety
 * - Balance query and monthly usage cycle reset
 *
 * Layer: tree/organizations (Pure domain logic - only imports from @/seed)
 *
 * @module tree/organizations/mcu-allocation-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  AllocateMcuInput,
  DeductMcuInput,
  SubaccountMcuAllocation,
  SubaccountMcuQuota,
} from '@/seed/types/agency-multitenancy';

interface AllocationRow {
  id: string;
  subaccount_id: string;
  allocated_mcu: number;
  used_mcu: number;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToAllocation(row: AllocationRow): SubaccountMcuAllocation {
  const allocated = Number(row.allocated_mcu ?? 0);
  const used = Number(row.used_mcu ?? 0);
  const remaining = Math.max(0, allocated - used);

  return {
    id: row.id,
    subaccountId: row.subaccount_id,
    allocatedMcu: allocated,
    usedMcu: used,
    remainingMcu: remaining,
    periodStart: row.period_start ?? undefined,
    periodEnd: row.period_end ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Allocates or updates MCU quota for a client subaccount.
 */
export async function allocateSubaccountMcu(
  db: D1Database,
  input: AllocateMcuInput
): Promise<SubaccountMcuAllocation> {
  const { subaccountId, allocatedMcu, periodStart, periodEnd } = input;

  if (allocatedMcu < 0) {
    throw new Error('VALIDATION_ERROR: allocatedMcu must be greater than or equal to 0');
  }

  const existing = await db
    .prepare('SELECT * FROM subaccount_mcu_allocations WHERE subaccount_id = ?')
    .bind(subaccountId)
    .first<AllocationRow>();

  const now = new Date().toISOString();

  if (existing) {
    await db
      .prepare(`
        UPDATE subaccount_mcu_allocations
        SET allocated_mcu = ?, period_start = ?, period_end = ?, updated_at = ?
        WHERE subaccount_id = ?
      `)
      .bind(
        allocatedMcu,
        periodStart ?? existing.period_start,
        periodEnd ?? existing.period_end,
        now,
        subaccountId
      )
      .run();
  } else {
    const id = `mcu_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await db
      .prepare(`
        INSERT INTO subaccount_mcu_allocations (
          id, subaccount_id, allocated_mcu, used_mcu, period_start, period_end, created_at, updated_at
        ) VALUES (?, ?, ?, 0, ?, ?, ?, ?)
      `)
      .bind(
        id,
        subaccountId,
        allocatedMcu,
        periodStart ?? null,
        periodEnd ?? null,
        now,
        now
      )
      .run();
  }

  const updated = await db
    .prepare('SELECT * FROM subaccount_mcu_allocations WHERE subaccount_id = ?')
    .bind(subaccountId)
    .first<AllocationRow>();

  if (!updated) {
    throw new Error('INTERNAL_ERROR: Failed to retrieve updated MCU allocation');
  }

  return mapRowToAllocation(updated);
}

/**
 * Checks whether a subaccount has sufficient remaining MCU quota for an operation.
 */
export async function checkSubaccountQuota(
  db: D1Database,
  subaccountId: string,
  requestedMcu: number = 1
): Promise<{
  isAllowed: boolean;
  remainingMcu: number;
  allocatedMcu: number;
  usedMcu: number;
  reason?: string;
}> {
  if (requestedMcu < 0) {
    throw new Error('VALIDATION_ERROR: requestedMcu cannot be negative');
  }

  const row = await db
    .prepare('SELECT * FROM subaccount_mcu_allocations WHERE subaccount_id = ?')
    .bind(subaccountId)
    .first<AllocationRow>();

  if (!row) {
    return {
      isAllowed: false,
      remainingMcu: 0,
      allocatedMcu: 0,
      usedMcu: 0,
      reason: 'NO_ALLOCATION_FOUND: Subaccount has no MCU allocation configured',
    };
  }

  const allocated = Number(row.allocated_mcu ?? 0);
  const used = Number(row.used_mcu ?? 0);
  const remaining = Math.max(0, allocated - used);

  if (remaining < requestedMcu) {
    return {
      isAllowed: false,
      remainingMcu: remaining,
      allocatedMcu: allocated,
      usedMcu: used,
      reason: `MCU_QUOTA_EXCEEDED: Requested ${requestedMcu} MCU but only ${remaining} remaining (${used}/${allocated} used)`,
    };
  }

  return {
    isAllowed: true,
    remainingMcu: remaining,
    allocatedMcu: allocated,
    usedMcu: used,
  };
}

/**
 * Atomically deducts MCU credits from a subaccount allocation with quota check guard.
 */
export async function deductSubaccountMcu(
  db: D1Database,
  input: DeductMcuInput
): Promise<{
  success: boolean;
  newUsedMcu: number;
  remainingMcu: number;
}> {
  const { subaccountId, amount } = input;

  if (amount <= 0) {
    throw new Error('VALIDATION_ERROR: Deduction amount must be greater than 0');
  }

  const now = new Date().toISOString();

  // Atomic conditional update ensuring allocation exists and has enough remaining credits
  const result = await db
    .prepare(`
      UPDATE subaccount_mcu_allocations
      SET used_mcu = used_mcu + ?, updated_at = ?
      WHERE subaccount_id = ? AND (allocated_mcu - used_mcu) >= ?
    `)
    .bind(amount, now, subaccountId, amount)
    .run();

  const changes = result.meta?.changes ?? (result as unknown as { changes?: number }).changes ?? 0;

  if (changes === 0) {
    // Determine why the atomic update failed
    const row = await db
      .prepare('SELECT * FROM subaccount_mcu_allocations WHERE subaccount_id = ?')
      .bind(subaccountId)
      .first<AllocationRow>();

    if (!row) {
      throw new Error(`NO_ALLOCATION_FOUND: Subaccount '${subaccountId}' has no MCU allocation record`);
    }

    const remaining = Math.max(0, Number(row.allocated_mcu ?? 0) - Number(row.used_mcu ?? 0));
    throw new Error(
      `MCU_QUOTA_EXCEEDED: Cannot deduct ${amount} MCU from subaccount '${subaccountId}' (Remaining: ${remaining})`
    );
  }

  const updated = await db
    .prepare('SELECT * FROM subaccount_mcu_allocations WHERE subaccount_id = ?')
    .bind(subaccountId)
    .first<AllocationRow>();

  if (!updated) {
    throw new Error('INTERNAL_ERROR: Failed to retrieve updated balance after deduction');
  }

  const newUsed = Number(updated.used_mcu ?? 0);
  const remaining = Math.max(0, Number(updated.allocated_mcu ?? 0) - newUsed);

  return {
    success: true,
    newUsedMcu: newUsed,
    remainingMcu: remaining,
  };
}

/**
 * Retrieves the current MCU balance and usage for a subaccount.
 */
export async function getSubaccountMcuBalance(
  db: D1Database,
  subaccountId: string
): Promise<SubaccountMcuQuota> {
  const row = await db
    .prepare('SELECT * FROM subaccount_mcu_allocations WHERE subaccount_id = ?')
    .bind(subaccountId)
    .first<AllocationRow>();

  if (!row) {
    return { allocated: 0, used: 0, remaining: 0 };
  }

  const allocated = Number(row.allocated_mcu ?? 0);
  const used = Number(row.used_mcu ?? 0);
  const remaining = Math.max(0, allocated - used);

  return { allocated, used, remaining };
}

/**
 * Resets the used MCU count for a subaccount (e.g. at the start of a new monthly billing cycle).
 */
export async function resetSubaccountMcuUsage(
  db: D1Database,
  subaccountId: string
): Promise<SubaccountMcuAllocation> {
  const now = new Date().toISOString();
  await db
    .prepare('UPDATE subaccount_mcu_allocations SET used_mcu = 0, updated_at = ? WHERE subaccount_id = ?')
    .bind(now, subaccountId)
    .run();

  const updated = await db
    .prepare('SELECT * FROM subaccount_mcu_allocations WHERE subaccount_id = ?')
    .bind(subaccountId)
    .first<AllocationRow>();

  if (!updated) {
    throw new Error(`NO_ALLOCATION_FOUND: Subaccount '${subaccountId}' not found`);
  }

  return mapRowToAllocation(updated);
}
