/**
 * Co-Op Marketing Budget Sweeper & Partner Summary Engine
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/budget-sweeper
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerProfile,
  CoOpBudgetAllocation,
  PartnerCoOpClaim,
  CoOpClaimStatus,
} from '@/tree/partners/types';
import { CO_OP_ACCRUAL_RATE_PCT } from './constants';
import type { SweepExpiredBudgetsResult, PartnerCoOpSummary } from './types';

/**
 * Sweeps and reclaims expired unspent Co-Op budget allocations after 90 days.
 *
 * @param db - D1Database instance.
 * @param currentTimestampMs - Current timestamp in milliseconds (defaults to Date.now()).
 */
export async function sweepExpiredCoOpBudgets(
  db: D1Database,
  currentTimestampMs?: number,
): Promise<SweepExpiredBudgetsResult> {
  const cutoff = currentTimestampMs ?? Date.now();

  const expiredAllocations = await db
    .prepare(`
      SELECT id, remaining_cents
      FROM co_op_budget_allocations
      WHERE status = 'active' AND expires_at <= ?
    `)
    .bind(cutoff)
    .all<{ id: string; remaining_cents: number }>();

  const items = expiredAllocations.results ?? [];
  if (items.length === 0) {
    return { expiredCount: 0, reclaimedCents: 0 };
  }

  const reclaimedCents = items.reduce((sum, item) => sum + Math.max(0, item.remaining_cents), 0);

  await db
    .prepare(`
      UPDATE co_op_budget_allocations
      SET status = 'expired', updated_at = ?1
      WHERE status = 'active' AND expires_at <= ?2
    `)
    .bind(cutoff, cutoff)
    .run();

  return {
    expiredCount: items.length,
    reclaimedCents,
  };
}

/**
 * Retrieves aggregated Co-Op marketing summary for a partner.
 */
export async function getPartnerCoOpSummary(
  db: D1Database,
  partnerId: string,
): Promise<PartnerCoOpSummary | null> {
  const partner = await db
    .prepare('SELECT id, partner_name, tier, status FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerProfile>();

  if (!partner) {
    return null;
  }

  const isEligible = partner.tier === 'GOLD' || partner.tier === 'PLATINUM';
  const now = Date.now();

  const allocationsRes = await db
    .prepare('SELECT * FROM co_op_budget_allocations WHERE partner_id = ?')
    .bind(partnerId)
    .all<CoOpBudgetAllocation>();

  const allocations = allocationsRes.results ?? [];
  const activeAllocations = allocations.filter((a) => a.status === 'active' && a.expires_at > now);

  const totalAllocatedCents = allocations.reduce((sum, a) => sum + a.allocated_cents, 0);
  const totalClaimedCents = allocations.reduce((sum, a) => sum + a.claimed_cents, 0);
  const remainingActiveBudgetCents = activeAllocations.reduce((sum, a) => sum + a.remaining_cents, 0);

  const claimsRes = await db
    .prepare('SELECT status, approved_amount_cents FROM partner_co_op_claims WHERE partner_id = ?')
    .bind(partnerId)
    .all<{ status: CoOpClaimStatus; approved_amount_cents: number }>();

  const claims = claimsRes.results ?? [];
  const pendingClaimsCount = claims.filter(
    (c) => c.status === 'submitted' || c.status === 'under_review' || c.status === 'processing',
  ).length;
  const approvedClaimsCount = claims.filter((c) => c.status === 'approved' || c.status === 'paid').length;

  return {
    partnerId: partner.id,
    partnerName: partner.partner_name,
    tier: partner.tier,
    isEligible,
    accrualRatePct: isEligible ? CO_OP_ACCRUAL_RATE_PCT : 0,
    totalAllocatedCents,
    totalClaimedCents,
    remainingActiveBudgetCents,
    availableBudgetCents: remainingActiveBudgetCents,
    activeAllocationsCount: activeAllocations.length,
    pendingClaimsCount,
    approvedClaimsCount,
  };
}

/**
 * Retrieves budget allocations for a partner.
 */
export async function getPartnerCoOpAllocations(
  db: D1Database,
  partnerId: string,
): Promise<CoOpBudgetAllocation[]> {
  const result = await db
    .prepare('SELECT * FROM co_op_budget_allocations WHERE partner_id = ? ORDER BY created_at DESC')
    .bind(partnerId)
    .all<CoOpBudgetAllocation>();

  return result.results ?? [];
}

/**
 * Retrieves claims submitted by a partner with optional status filter.
 */
export async function getPartnerCoOpClaims(
  db: D1Database,
  partnerId: string,
  status?: CoOpClaimStatus,
): Promise<PartnerCoOpClaim[]> {
  if (status) {
    const result = await db
      .prepare('SELECT * FROM partner_co_op_claims WHERE partner_id = ? AND status = ? ORDER BY created_at DESC')
      .bind(partnerId, status)
      .all<PartnerCoOpClaim>();
    return result.results ?? [];
  }

  const result = await db
    .prepare('SELECT * FROM partner_co_op_claims WHERE partner_id = ? ORDER BY created_at DESC')
    .bind(partnerId)
    .all<PartnerCoOpClaim>();
  return result.results ?? [];
}
