/**
 * Agency Client Subaccount Management & MCU Reallocation Server Actions
 *
 * Layer: land/agency
 *
 * @module land/agency/portal-actions/management-mutator
 */

'use server';

import { logger } from '@/seed/utils/logger-utility';
import { resolveDb } from './common';

/**
 * Updates client subaccount status (active vs suspended) with compound tenant isolation.
 */
export async function updateClientSubaccountStatusAction(
  subaccountId: string,
  agencyOrgId: string,
  status: 'active' | 'suspended',
  dbOverride?: unknown
): Promise<{ success: boolean; error?: string }> {
  if (!subaccountId || typeof subaccountId !== 'string' || !agencyOrgId || typeof agencyOrgId !== 'string') {
    return { success: false, error: 'SUBACCOUNT_NOT_FOUND_OR_FORBIDDEN' };
  }

  const db = resolveDb(dbOverride);
  const now = new Date().toISOString();

  try {
    const res = await db
      .prepare(
        `UPDATE client_subaccounts
         SET status = ?1, updated_at = ?2
         WHERE id = ?3 AND agency_org_id = ?4`
      )
      .bind(status, now, subaccountId, agencyOrgId)
      .run();

    if (!res.meta?.changes) {
      return { success: false, error: 'SUBACCOUNT_NOT_FOUND_OR_FORBIDDEN' };
    }

    return { success: true };
  } catch (err) {
    logger.error('[Agency Actions] Failed to update client status', {
      error: String(err),
      subaccountId,
      agencyOrgId,
    });
    return { success: false, error: 'DATABASE_ERROR' };
  }
}

/**
 * Reallocates MCU quota for a subaccount with tenant verification.
 */
export async function reallocateClientMcuQuotaAction(
  subaccountId: string,
  agencyOrgId: string,
  allocatedMcu: number,
  dbOverride?: unknown
): Promise<{ success: boolean; remainingMcu?: number; error?: string }> {
  if (!subaccountId || typeof subaccountId !== 'string' || !agencyOrgId || typeof agencyOrgId !== 'string') {
    return { success: false, error: 'SUBACCOUNT_NOT_FOUND_OR_FORBIDDEN' };
  }

  if (!Number.isFinite(allocatedMcu) || allocatedMcu < 0) {
    return { success: false, error: 'INVALID_MCU_AMOUNT' };
  }

  const db = resolveDb(dbOverride);
  const now = new Date().toISOString();

  try {
    // Verify client belongs to this agency
    const client = await db
      .prepare('SELECT id FROM client_subaccounts WHERE id = ?1 AND agency_org_id = ?2')
      .bind(subaccountId, agencyOrgId)
      .first<{ id: string }>();

    if (!client) {
      return { success: false, error: 'SUBACCOUNT_NOT_FOUND_OR_FORBIDDEN' };
    }

    // Update quota
    await db
      .prepare(
        `UPDATE subaccount_mcu_allocations
         SET allocated_mcu = ?1, updated_at = ?2
         WHERE subaccount_id = ?3`
      )
      .bind(allocatedMcu, now, subaccountId)
      .run();

    return { success: true, remainingMcu: allocatedMcu };
  } catch (err) {
    logger.error('[Agency Actions] Failed to reallocate MCU quota', {
      error: String(err),
      subaccountId,
      agencyOrgId,
    });
    return { success: false, error: 'DATABASE_ERROR' };
  }
}
