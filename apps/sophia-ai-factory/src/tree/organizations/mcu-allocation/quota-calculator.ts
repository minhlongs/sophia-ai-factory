/**
 * MCU Quota Calculator & Balance Queries
 * Layer: tree/organizations (domain reusable)
 *
 * @module tree/organizations/mcu-allocation/quota-calculator
 */

import type { D1Database } from '@/seed/db/client';
import type { SubaccountMcuQuota } from '@/seed/types/agency-multitenancy';
import type { AllocationRow, CheckQuotaResult } from './types';

/**
 * Checks whether a subaccount has sufficient remaining MCU quota for an operation.
 */
export async function checkSubaccountQuota(
  db: D1Database,
  subaccountId: string,
  requestedMcu: number = 1
): Promise<CheckQuotaResult> {
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
