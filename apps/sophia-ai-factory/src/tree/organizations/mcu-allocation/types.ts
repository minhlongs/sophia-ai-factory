/**
 * Subaccount MCU Allocation Types & Mappers
 * Layer: tree/organizations (domain reusable)
 *
 * @module tree/organizations/mcu-allocation/types
 */

import type {
  AllocateMcuInput,
  DeductMcuInput,
  SubaccountMcuAllocation,
  SubaccountMcuQuota,
} from '@/seed/types/agency-multitenancy';

export type {
  AllocateMcuInput,
  DeductMcuInput,
  SubaccountMcuAllocation,
  SubaccountMcuQuota,
};

export interface AllocationRow {
  id: string;
  subaccount_id: string;
  allocated_mcu: number;
  used_mcu: number;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckQuotaResult {
  isAllowed: boolean;
  remainingMcu: number;
  allocatedMcu: number;
  usedMcu: number;
  reason?: string;
}

export interface DeductMcuResult {
  success: boolean;
  newUsedMcu: number;
  remainingMcu: number;
}

export function mapRowToAllocation(row: AllocationRow): SubaccountMcuAllocation {
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
