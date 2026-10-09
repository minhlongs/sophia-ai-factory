/**
 * Co-Op Marketing Budget Accrual Calculator & Allocator
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/accrual-calculator
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PartnerProfile, PartnerTier, CoOpBudgetAllocation } from '@/tree/partners/types';
import { CO_OP_ACCRUAL_RATE_PCT, CO_OP_BUDGET_EXPIRY_MS } from './constants';
import type { AccrueCoOpBudgetResult } from './types';

/**
 * Calculates monthly Co-Op marketing fund accrual with guaranteed zero penny leakage.
 *
 * Rules:
 * - GOLD (28%) & PLATINUM (35%) partners are eligible for 5% monthly Co-Op accrual.
 * - SILVER (20%) partners accrue 0%.
 * - Formula: Math.floor((mrrCents * 5) / 100).
 */
export function calculateMonthlyCoOpAccrual(mrrCents: number, tier: PartnerTier): number {
  if (mrrCents <= 0 || !Number.isFinite(mrrCents)) {
    return 0;
  }

  // Only Gold and Platinum tiers receive Co-Op funds
  if (tier !== 'GOLD' && tier !== 'PLATINUM') {
    return 0;
  }

  const validMrr = Math.floor(mrrCents);
  return Math.floor((validMrr * CO_OP_ACCRUAL_RATE_PCT) / 100);
}

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
  const now = Date.now();
  const expiresAt = now + CO_OP_BUDGET_EXPIRY_MS;
  const allocationId = `coop_${crypto.randomUUID().slice(0, 16)}`;

  await db
    .prepare(`
      INSERT INTO co_op_budget_allocations (
        id, partner_id, billing_cycle_month, tier_at_time, mrr_basis_cents,
        accrual_rate_pct, allocated_cents, claimed_cents, remaining_cents,
        expires_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'active', ?, ?)
    `)
    .bind(
      allocationId,
      partnerId,
      trimmedCycle,
      effectiveTier,
      Math.floor(mrrCents),
      CO_OP_ACCRUAL_RATE_PCT,
      allocatedCents,
      allocatedCents,
      expiresAt,
      now,
      now,
    )
    .run();

  const createdAllocation: CoOpBudgetAllocation = {
    id: allocationId,
    partner_id: partnerId,
    billing_cycle_month: trimmedCycle,
    tier_at_time: effectiveTier as 'GOLD' | 'PLATINUM',
    mrr_basis_cents: Math.floor(mrrCents),
    accrual_rate_pct: CO_OP_ACCRUAL_RATE_PCT,
    allocated_cents: allocatedCents,
    claimed_cents: 0,
    remaining_cents: allocatedCents,
    expires_at: expiresAt,
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  return {
    success: true,
    allocation: createdAllocation,
    allocatedCents,
    alreadyAccrued: false,
  };
}
