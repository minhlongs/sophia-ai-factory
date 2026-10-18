/**
 * Reseller Binding Pre-Condition & Hierarchy Validator
 *
 * Layer: tree/partners/hierarchy
 *
 * @module tree/partners/hierarchy/reseller-bind-validator
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { BindSubResellerResult } from '@/tree/partners/types';
import { detectHierarchyCycle } from './cycle-detector';

/**
 * Validates whether a Sub-Agency can be bound to a Master Agency.
 * Returns null if valid, or a failure BindSubResellerResult if any constraint fails.
 */
export async function validateResellerBindEligibility(
  db: D1Database,
  masterPartnerId: string,
  subPartnerId: string,
): Promise<BindSubResellerResult | null> {
  // 1. Anti-circularity: Cannot bind self to self
  if (!masterPartnerId || !subPartnerId || masterPartnerId === subPartnerId) {
    return {
      success: false,
      error: 'CIRCULAR_HIERARCHY_PROHIBITED',
    };
  }

  // 2. Verify Master Partner exists and is active
  const master = await db
    .prepare('SELECT id, status, partner_name FROM partner_profiles WHERE id = ?')
    .bind(masterPartnerId)
    .first<{ id: string; status: string; partner_name: string }>();

  if (!master) {
    return { success: false, error: 'MASTER_PARTNER_NOT_FOUND' };
  }

  if (master.status !== 'active') {
    return {
      success: false,
      error: master.status === 'suspended' ? 'MASTER_PARTNER_SUSPENDED' : 'MASTER_PARTNER_NOT_ACTIVE',
    };
  }

  // 3. Verify Sub Partner exists and is active
  const sub = await db
    .prepare('SELECT id, status, partner_name FROM partner_profiles WHERE id = ?')
    .bind(subPartnerId)
    .first<{ id: string; status: string; partner_name: string }>();

  if (!sub) {
    return { success: false, error: 'SUB_PARTNER_NOT_FOUND' };
  }

  if (sub.status !== 'active') {
    return {
      success: false,
      error: sub.status === 'suspended' ? 'SUB_PARTNER_SUSPENDED' : 'SUB_PARTNER_NOT_ACTIVE',
    };
  }

  // 4. Single-Parent Constraint: Sub-Agency cannot have multiple active parents
  const existingParent = await db
    .prepare('SELECT id, master_partner_id, status FROM partner_sub_resellers WHERE sub_partner_id = ? AND status != ?')
    .bind(subPartnerId, 'terminated')
    .first<{ id: string; master_partner_id: string; status: string }>();

  if (existingParent) {
    return { success: false, error: 'SUB_AGENCY_ALREADY_BOUND' };
  }

  // 5. Anti-circularity check
  const hasCycle = await detectHierarchyCycle(db, masterPartnerId, subPartnerId);
  if (hasCycle) {
    return { success: false, error: 'CIRCULAR_HIERARCHY_PROHIBITED' };
  }

  return null;
}
