/**
 * Co-Op Marketing Budget Accrual Formula & Persistence Helpers
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/accrual-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { CoOpBudgetAllocation, PartnerTier } from '@/tree/partners/types';
import { CO_OP_ACCRUAL_RATE_PCT, CO_OP_BUDGET_EXPIRY_MS } from './constants';

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

export async function insertCoOpBudgetAllocation(params: {
  db: D1Database;
  partnerId: string;
  trimmedCycle: string;
  effectiveTier: 'GOLD' | 'PLATINUM';
  mrrCents: number;
  allocatedCents: number;
}): Promise<CoOpBudgetAllocation> {
  const { db, partnerId, trimmedCycle, effectiveTier, mrrCents, allocatedCents } = params;
  const now = Date.now();
  const expiresAt = now + CO_OP_BUDGET_EXPIRY_MS;
  const allocationId = `coop_${crypto.randomUUID().slice(0, 16)}`;
  const mrrBasisCents = Math.floor(mrrCents);

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
      mrrBasisCents,
      CO_OP_ACCRUAL_RATE_PCT,
      allocatedCents,
      allocatedCents,
      expiresAt,
      now,
      now,
    )
    .run();

  return {
    id: allocationId,
    partner_id: partnerId,
    billing_cycle_month: trimmedCycle,
    tier_at_time: effectiveTier,
    mrr_basis_cents: mrrBasisCents,
    accrual_rate_pct: CO_OP_ACCRUAL_RATE_PCT,
    allocated_cents: allocatedCents,
    claimed_cents: 0,
    remaining_cents: allocatedCents,
    expires_at: expiresAt,
    status: 'active',
    created_at: now,
    updated_at: now,
  };
}
