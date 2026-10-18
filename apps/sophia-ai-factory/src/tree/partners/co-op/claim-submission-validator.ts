/**
 * Co-Op Marketing Claim Eligibility & Solvency Validator
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/claim-submission-validator
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerProfile,
  CoOpBudgetAllocation,
} from '@/tree/partners/types';
import type { SubmitCoOpClaimResult } from './types';

export interface ValidatedClaimAllocationContext {
  targetAlloc: CoOpBudgetAllocation;
  totalAvailableCents: number;
}

export async function validateClaimPartnerAndBudget(
  db: D1Database,
  partnerId: string,
  invoiceNumber: string,
  requestedCents: number,
  now: number,
): Promise<{ errorResult?: SubmitCoOpClaimResult; context?: ValidatedClaimAllocationContext }> {
  // 1. Verify partner exists and is active
  const partner = await db
    .prepare('SELECT id, partner_name, tier, status FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerProfile>();

  if (!partner) {
    return { errorResult: { success: false, error: 'PARTNER_NOT_FOUND' } };
  }

  if (partner.status !== 'active') {
    return {
      errorResult: {
        success: false,
        error: partner.status === 'suspended' ? 'PARTNER_SUSPENDED' : 'PARTNER_NOT_ACTIVE',
      },
    };
  }

  // 2. Idempotency Check: Reject duplicate invoice submission per partner
  const duplicate = await db
    .prepare('SELECT id FROM partner_co_op_claims WHERE partner_id = ? AND invoice_number = ?')
    .bind(partnerId, invoiceNumber)
    .first<{ id: string }>();

  if (duplicate) {
    return { errorResult: { success: false, error: 'DUPLICATE_INVOICE_SUBMISSION' } };
  }

  // 3. Solvency Check: Find active, non-expired budget allocations for this partner
  const allocationsResult = await db
    .prepare(`
      SELECT * FROM co_op_budget_allocations
      WHERE partner_id = ? AND status = 'active' AND expires_at > ? AND remaining_cents > 0
      ORDER BY expires_at ASC
    `)
    .bind(partnerId, now)
    .all<CoOpBudgetAllocation>();

  const activeAllocations = allocationsResult.results ?? [];
  const totalAvailableCents = activeAllocations.reduce((sum, a) => sum + a.remaining_cents, 0);

  if (totalAvailableCents < requestedCents) {
    return { errorResult: { success: false, error: 'INSUFFICIENT_CO_OP_BUDGET' } };
  }

  const targetAlloc =
    activeAllocations.find((a) => a.remaining_cents >= requestedCents) ?? activeAllocations[0];

  return {
    context: {
      targetAlloc,
      totalAvailableCents,
    },
  };
}
