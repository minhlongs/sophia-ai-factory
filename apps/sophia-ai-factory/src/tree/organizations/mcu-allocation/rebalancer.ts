/**
 * MCU Rebalancer & Deduction Guard Operations
 * Layer: tree/organizations (domain reusable)
 *
 * @module tree/organizations/mcu-allocation/rebalancer
 */

import type { D1Database } from '@/seed/db/client';
import type { DeductMcuInput, SubaccountMcuAllocation } from '@/seed/types/agency-multitenancy';
import { mapRowToAllocation, type AllocationRow, type DeductMcuResult } from './types';

/**
 * Atomically deducts MCU credits from a subaccount allocation with quota check guard.
 */
export async function deductSubaccountMcu(
  db: D1Database,
  input: DeductMcuInput
): Promise<DeductMcuResult> {
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
