/**
 * Reseller Binding and Unbinding Operations
 *
 * Layer: tree (domain business logic & D1 operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/hierarchy/reseller-binder
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerSubReseller,
  BindSubResellerResult,
} from '@/tree/partners/types';
import { MASTER_CASCADE_OVERRIDE_RATE_PCT } from './cascade-calculator';
import { detectHierarchyCycle } from './cycle-detector';

/**
 * Binds a Sub-Agency to a Master Agency enforcing anti-circularity and single-parent constraints.
 */
export async function bindSubReseller(
  db: D1Database,
  masterPartnerId: string,
  subPartnerId: string,
  agreementRef: string | null = null,
): Promise<BindSubResellerResult> {
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

  // 6. Clean up any terminated binding for this sub-agency to satisfy UNIQUE constraint
  await db
    .prepare("DELETE FROM partner_sub_resellers WHERE sub_partner_id = ? AND status = 'terminated'")
    .bind(subPartnerId)
    .run();

  // 7. Insert new binding
  const bindingId = `subres_${crypto.randomUUID().slice(0, 16)}`;
  const now = Date.now();

  const insertResult = await db
    .prepare(`
      INSERT INTO partner_sub_resellers (
        id,
        master_partner_id,
        sub_partner_id,
        agreement_ref,
        override_rate_pct,
        lifetime_override_cents,
        pending_override_cents,
        status,
        joined_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      bindingId,
      masterPartnerId,
      subPartnerId,
      agreementRef?.trim() ?? null,
      MASTER_CASCADE_OVERRIDE_RATE_PCT,
      0,
      0,
      'active',
      now,
      now,
    )
    .run();

  if (!insertResult.success) {
    return { success: false, error: 'DATABASE_INSERT_FAILED' };
  }

  const createdBinding: PartnerSubReseller = {
    id: bindingId,
    master_partner_id: masterPartnerId,
    sub_partner_id: subPartnerId,
    agreement_ref: agreementRef?.trim() ?? null,
    override_rate_pct: MASTER_CASCADE_OVERRIDE_RATE_PCT,
    lifetime_override_cents: 0,
    pending_override_cents: 0,
    status: 'active',
    joined_at: now,
    updated_at: now,
  };

  return { success: true, binding: createdBinding };
}

/**
 * Unbinds or terminates a sub-agency partnership link.
 */
export async function unbindSubReseller(
  db: D1Database,
  masterPartnerId: string,
  subPartnerId: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await db
    .prepare(`
      UPDATE partner_sub_resellers
      SET status = 'terminated',
          updated_at = ?1
      WHERE master_partner_id = ?2 AND sub_partner_id = ?3 AND status != 'terminated'
    `)
    .bind(Date.now(), masterPartnerId, subPartnerId)
    .run();

  if ((res.meta?.changes ?? 0) === 0) {
    return { success: false, error: 'BINDING_NOT_FOUND_OR_ALREADY_TERMINATED' };
  }

  return { success: true };
}
