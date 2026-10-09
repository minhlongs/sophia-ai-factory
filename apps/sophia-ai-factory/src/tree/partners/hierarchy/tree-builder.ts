/**
 * Reseller Hierarchy Tree Query & Aggregation Engine
 *
 * Layer: tree (domain business logic & D1 operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/hierarchy/tree-builder
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerProfile,
  ResellerHierarchyNode,
  ResellerHierarchyTreeResult,
} from '@/tree/partners/types';
import { MASTER_CASCADE_OVERRIDE_RATE_PCT } from './cascade-calculator';

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
