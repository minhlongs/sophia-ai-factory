/**
 * Enterprise Reseller Federation & Multi-Tier Agency Hierarchy Domain Service
 *
 * Layer: tree (domain business logic, math models & D1 database operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * Invariants:
 * 1. Zero Penny Leakage: Pure integer cent math ensuring C_master + C_sub + P_net == M.
 * 2. Anti-Circularity: Master != Sub, and no bidirectional delegation cycles.
 * 3. Single-Parent Constraint: Sub-agencies can be bound to at most ONE active master agency.
 * 4. Escrow on Suspension: If master agency is suspended, cascade override is escrowed.
 *
 * @module tree/partners/reseller-hierarchy
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerProfile,
  PartnerSubReseller,
  CascadeOverrideResult,
  BindSubResellerResult,
  ResellerHierarchyNode,
  ResellerHierarchyTreeResult,
  AccrueCascadeOverrideResult,
} from '@/tree/partners/types';

/**
 * Standard Master Agency cascade override percentage (5.0%).
 */
export const MASTER_CASCADE_OVERRIDE_RATE_PCT = 5.0;

/**
 * Calculates the 5% Cascade Override and Sub-Agency Commission with guaranteed zero penny leakage.
 *
 * Mathematical Invariants:
 * - C_master = hasActiveMaster ? floor((M * 5) / 100) : 0
 * - C_sub = floor((M * R_sub) / 100)
 * - P_net = M - C_sub - C_master
 * - C_master + C_sub + P_net == M for all M >= 0
 *
 * @param mrrCents - Gross MRR transaction amount in integer cents.
 * @param subTierRatePct - Commission rate percentage of the Sub-Agency (e.g. 20, 28, 35).
 * @param hasActiveMaster - Whether the Sub-Agency is bound to an active Master Agency.
 * @param masterPartnerId - Optional ID of the Master Agency.
 */
export function calculateCascadeOverride(
  mrrCents: number,
  subTierRatePct: number,
  hasActiveMaster: boolean,
  masterPartnerId: string | null = null,
): CascadeOverrideResult {
  if (mrrCents <= 0) {
    return {
      hasMaster: hasActiveMaster,
      masterPartnerId: hasActiveMaster ? masterPartnerId : null,
      overrideCents: 0,
      overrideRatePct: hasActiveMaster ? MASTER_CASCADE_OVERRIDE_RATE_PCT : 0,
      subPartnerCommissionCents: 0,
      subPartnerRatePct: Math.max(0, subTierRatePct),
      platformNetCents: 0,
    };
  }

  const validMrr = Math.floor(mrrCents);
  const validSubRate = Math.max(0, subTierRatePct);

  // 1. Direct Sub-Agency Commission (Floor integer cents)
  const subPartnerCommissionCents = Math.floor((validMrr * validSubRate) / 100);

  // 2. Master Agency 5% Override (Floor integer cents, 0 if no active master)
  const overrideRatePct = hasActiveMaster ? MASTER_CASCADE_OVERRIDE_RATE_PCT : 0;
  const overrideCents = hasActiveMaster
    ? Math.floor((validMrr * MASTER_CASCADE_OVERRIDE_RATE_PCT) / 100)
    : 0;

  // 3. Platform Net Retention: Exact difference guaranteeing Zero Penny Leakage
  const platformNetCents = validMrr - subPartnerCommissionCents - overrideCents;

  return {
    hasMaster: hasActiveMaster,
    masterPartnerId: hasActiveMaster ? masterPartnerId : null,
    overrideCents,
    overrideRatePct,
    subPartnerCommissionCents,
    subPartnerRatePct: validSubRate,
    platformNetCents,
  };
}

/**
 * Binds a Sub-Agency to a Master Agency enforcing anti-circularity and single-parent constraints.
 *
 * @param db - D1Database instance.
 * @param masterPartnerId - ID of the Master Agency (partner_profiles.id).
 * @param subPartnerId - ID of the Sub-Agency (partner_profiles.id).
 * @param agreementRef - Optional legal or SLA agreement reference identifier.
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
    return {
      success: false,
      error: 'MASTER_PARTNER_NOT_FOUND',
    };
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
    return {
      success: false,
      error: 'SUB_PARTNER_NOT_FOUND',
    };
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
    return {
      success: false,
      error: 'SUB_AGENCY_ALREADY_BOUND',
    };
  }

  // 5. Anti-circularity: Multi-hop cycle prevention
  // Walk up the parent hierarchy from masterPartnerId to ensure subPartnerId is not an ancestor
  let currentAncestorId: string | null = masterPartnerId;
  const visitedAncestors = new Set<string>();
  const MAX_HIERARCHY_DEPTH = 50;
  let depth = 0;

  while (currentAncestorId && depth < MAX_HIERARCHY_DEPTH) {
    if (currentAncestorId === subPartnerId) {
      return {
        success: false,
        error: 'CIRCULAR_HIERARCHY_PROHIBITED',
      };
    }
    if (visitedAncestors.has(currentAncestorId)) {
      break;
    }
    visitedAncestors.add(currentAncestorId);

    const parentRow: { master_partner_id: string } | null = await db
      .prepare('SELECT master_partner_id FROM partner_sub_resellers WHERE sub_partner_id = ? AND status != ?')
      .bind(currentAncestorId, 'terminated')
      .first<{ master_partner_id: string }>();

    if (!parentRow) {
      break;
    }

    if (parentRow.master_partner_id === subPartnerId) {
      return {
        success: false,
        error: 'CIRCULAR_HIERARCHY_PROHIBITED',
      };
    }

    currentAncestorId = parentRow.master_partner_id;
    depth++;
  }

  // Also verify downstream descendants from subPartnerId do not contain masterPartnerId
  const queue: string[] = [subPartnerId];
  const seenDescendants = new Set<string>([subPartnerId]);
  let descIterations = 0;

  while (queue.length > 0 && descIterations < 500) {
    const current = queue.shift()!;
    descIterations++;

    const children = await db
      .prepare('SELECT sub_partner_id FROM partner_sub_resellers WHERE master_partner_id = ? AND status != ?')
      .bind(current, 'terminated')
      .all<{ sub_partner_id: string }>();

    for (const child of children.results ?? []) {
      if (child.sub_partner_id === masterPartnerId) {
        return {
          success: false,
          error: 'CIRCULAR_HIERARCHY_PROHIBITED',
        };
      }
      if (!seenDescendants.has(child.sub_partner_id)) {
        seenDescendants.add(child.sub_partner_id);
        queue.push(child.sub_partner_id);
      }
    }
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
    return {
      success: false,
      error: 'DATABASE_INSERT_FAILED',
    };
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

  return {
    success: true,
    binding: createdBinding,
  };
}

/**
 * Retrieves the full hierarchy tree and aggregated metrics for a Master Agency.
 *
 * @param db - D1Database instance.
 * @param masterPartnerId - ID of the Master Agency.
 */
export async function getResellerHierarchyTree(
  db: D1Database,
  masterPartnerId: string,
): Promise<ResellerHierarchyTreeResult> {
  const master = await db
    .prepare('SELECT id, partner_name, tier, status FROM partner_profiles WHERE id = ?')
    .bind(masterPartnerId)
    .first<PartnerProfile>();

  if (!master) {
    throw new Error(`Master partner profile not found: ${masterPartnerId}`);
  }

  const { results: rawRows } = await db
    .prepare(`
      SELECT
        psr.id,
        psr.sub_partner_id,
        psr.agreement_ref,
        psr.override_rate_pct,
        psr.lifetime_override_cents,
        psr.pending_override_cents,
        psr.status,
        psr.joined_at,
        sub.partner_name,
        sub.tier,
        sub.total_mrr_cents,
        sub.status AS sub_account_status
      FROM partner_sub_resellers psr
      JOIN partner_profiles sub ON psr.sub_partner_id = sub.id
      WHERE psr.master_partner_id = ?
      ORDER BY psr.joined_at DESC
    `)
    .bind(masterPartnerId)
    .all<{
      id: string;
      sub_partner_id: string;
      agreement_ref: string | null;
      override_rate_pct: number;
      lifetime_override_cents: number;
      pending_override_cents: number;
      status: 'active' | 'suspended' | 'terminated' | 'paused';
      joined_at: number;
      partner_name: string;
      tier: 'SILVER' | 'GOLD' | 'PLATINUM';
      total_mrr_cents: number;
      sub_account_status: string;
    }>();

  const subAgencies: ResellerHierarchyNode[] = (rawRows || []).map((row) => ({
    id: row.id,
    subPartnerId: row.sub_partner_id,
    partnerName: row.partner_name,
    tier: row.tier,
    status: row.status,
    totalMrrCents: row.total_mrr_cents ?? 0,
    overrideRatePct: row.override_rate_pct ?? MASTER_CASCADE_OVERRIDE_RATE_PCT,
    lifetimeOverrideCents: row.lifetime_override_cents ?? 0,
    pendingOverrideCents: row.pending_override_cents ?? 0,
    joinedAt: row.joined_at,
  }));

  const totalSubAgencies = subAgencies.length;
  const activeSubAgencies = subAgencies.filter((s) => s.status === 'active').length;
  const totalSubMrrCents = subAgencies.reduce((acc, curr) => acc + curr.totalMrrCents, 0);
  const totalLifetimeOverrideCents = subAgencies.reduce((acc, curr) => acc + curr.lifetimeOverrideCents, 0);
  const totalPendingOverrideCents = subAgencies.reduce((acc, curr) => acc + curr.pendingOverrideCents, 0);

  return {
    masterPartnerId: master.id,
    masterPartnerName: master.partner_name,
    masterTier: master.tier,
    masterStatus: master.status,
    totalSubAgencies,
    activeSubAgencies,
    totalSubMrrCents,
    totalLifetimeOverrideCents,
    totalPendingOverrideCents,
    subAgencies,
  };
}

/**
 * Accrues the 5% cascade override for a sub-agency's customer transaction.
 * Enforces Escrow Guardrail: If Master Agency is suspended, override is escrowed
 * and NOT credited to the master's pending payout balance.
 *
 * @param db - D1Database instance.
 * @param subPartnerId - Sub-Agency ID that generated the revenue.
 * @param orderId - Order / Transaction ID.
 * @param mrrCents - Transaction amount in integer cents.
 */
export async function accrueCascadeOverride(
  db: D1Database,
  subPartnerId: string,
  orderId: string,
  mrrCents: number,
): Promise<AccrueCascadeOverrideResult> {
  if (mrrCents <= 0) {
    return {
      success: true,
      overrideCents: 0,
      masterPartnerId: null,
      escrowed: false,
    };
  }

  // 1. Look up active hierarchy binding
  const binding = await db
    .prepare('SELECT * FROM partner_sub_resellers WHERE sub_partner_id = ? AND status = ?')
    .bind(subPartnerId, 'active')
    .first<PartnerSubReseller>();

  if (!binding) {
    // No upstream master bound; platform keeps 100% of the platform share
    return {
      success: true,
      overrideCents: 0,
      masterPartnerId: null,
      escrowed: false,
    };
  }

  // 2. Fetch master partner profile
  const master = await db
    .prepare('SELECT id, status, total_earnings_cents, pending_payout_cents FROM partner_profiles WHERE id = ?')
    .bind(binding.master_partner_id)
    .first<PartnerProfile>();

  if (!master) {
    return {
      success: false,
      overrideCents: 0,
      masterPartnerId: binding.master_partner_id,
      escrowed: false,
      error: 'MASTER_PARTNER_NOT_FOUND',
    };
  }

  const overrideCents = Math.floor((mrrCents * (binding.override_rate_pct ?? MASTER_CASCADE_OVERRIDE_RATE_PCT)) / 100);
  const now = Date.now();

  // 3. Escrow Guardrail: If master agency is suspended, hold funds in escrow
  if (master.status !== 'active') {
    // Track lifetime override earned for audit, but do NOT add to pending payout
    await db
      .prepare(`
        UPDATE partner_sub_resellers
        SET lifetime_override_cents = lifetime_override_cents + ?1,
            updated_at = ?2
        WHERE id = ?3
      `)
      .bind(overrideCents, now, binding.id)
      .run();

    return {
      success: true,
      overrideCents,
      masterPartnerId: master.id,
      escrowed: true,
      reason: master.status === 'suspended' ? 'MASTER_AGENCY_SUSPENDED' : 'MASTER_AGENCY_NOT_ACTIVE',
    };
  }

  // 4. Master Agency is Active: Credit override to binding and partner pending balances
  await db
    .prepare(`
      UPDATE partner_sub_resellers
      SET lifetime_override_cents = lifetime_override_cents + ?1,
          pending_override_cents = pending_override_cents + ?1,
          updated_at = ?2
      WHERE id = ?3
    `)
    .bind(overrideCents, now, binding.id)
    .run();

  await db
    .prepare(`
      UPDATE partner_profiles
      SET total_earnings_cents = total_earnings_cents + ?1,
          pending_payout_cents = pending_payout_cents + ?1,
          updated_at = ?2
      WHERE id = ?3
    `)
    .bind(overrideCents, now, master.id)
    .run();

  return {
    success: true,
    overrideCents,
    masterPartnerId: master.id,
    escrowed: false,
  };
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
