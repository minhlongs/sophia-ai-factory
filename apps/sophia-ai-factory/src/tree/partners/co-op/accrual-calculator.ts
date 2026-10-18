/**
 * Co-Op Marketing Budget Accrual Calculator & Allocator
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/accrual-calculator
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PartnerProfile, PartnerTier, CoOpBudgetAllocation } from '@/tree/partners/types';
import type { AccrueCoOpBudgetResult } from './types';
import {
  calculateMonthlyCoOpAccrual,
  insertCoOpBudgetAllocation,
} from './accrual-helpers';

export { calculateMonthlyCoOpAccrual };

/**
 * Accrues monthly Co-Op marketing budget for an eligible partner.
 *
 * Validates partner profile, tier eligibility, ensures 90-day expiration,
 * and maintains idempotency against duplicate cycle months.
 */
export async function accrueMonthlyCoOpBudget(
  db: D1Database,
  partnerId: string,
  cycleMonth: string,
  mrrCents: number,
  overrideTier?: PartnerTier,
): Promise<AccrueCoOpBudgetResult> {
  const trimmedCycle = cycleMonth?.trim();
  if (!trimmedCycle || !/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmedCycle)) {
    return { success: false, allocatedCents: 0, error: 'INVALID_CYCLE_MONTH' };
  }

  if (mrrCents < 0 || !Number.isFinite(mrrCents)) {
    return { success: false, allocatedCents: 0, error: 'INVALID_MRR_AMOUNT' };
  }

  const partner = await db
    .prepare('SELECT id, partner_name, tier, status FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerProfile>();

  if (!partner) {
    return { success: false, allocatedCents: 0, error: 'PARTNER_NOT_FOUND' };
  }

  if (partner.status !== 'active') {
    return {
      success: false,
      allocatedCents: 0,
      error: partner.status === 'suspended' ? 'PARTNER_SUSPENDED' : 'PARTNER_NOT_ACTIVE',
    };
  }

  const effectiveTier = overrideTier ?? partner.tier;
  if (effectiveTier !== 'GOLD' && effectiveTier !== 'PLATINUM') {
    return {
      success: false,
      allocatedCents: 0,
      error: 'TIER_NOT_ELIGIBLE_FOR_COOP',
    };
  }

  const existing = await db
    .prepare('SELECT * FROM co_op_budget_allocations WHERE partner_id = ? AND billing_cycle_month = ?')
    .bind(partnerId, trimmedCycle)
    .first<CoOpBudgetAllocation>();

  if (existing) {
    return {
      success: true,
      allocation: existing,
      allocatedCents: existing.allocated_cents,
      alreadyAccrued: true,
    };
  }

  const allocatedCents = calculateMonthlyCoOpAccrual(mrrCents, effectiveTier);
  const createdAllocation = await insertCoOpBudgetAllocation({
    db,
    partnerId,
    trimmedCycle,
    effectiveTier,
    mrrCents,
    allocatedCents,
  });

  return {
    success: true,
    allocation: createdAllocation,
    allocatedCents,
    alreadyAccrued: false,
  };
}
