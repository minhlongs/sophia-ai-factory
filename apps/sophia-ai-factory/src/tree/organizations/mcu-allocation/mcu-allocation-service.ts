/**
 * Subaccount MCU Allocation Service Operations
 * Layer: tree/organizations (domain reusable)
 *
 * @module tree/organizations/mcu-allocation/mcu-allocation-service
 */

import type { D1Database } from '@/seed/db/client';
import type { AllocateMcuInput, SubaccountMcuAllocation } from '@/seed/types/agency-multitenancy';
import { mapRowToAllocation, type AllocationRow } from './types';

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
