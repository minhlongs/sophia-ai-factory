/**
 * Co-Op Marketing Claim Submission & Validation Engine
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/claim-submission
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerProfile,
  CoOpBudgetAllocation,
  PartnerCoOpClaim,
  CoOpClaimStatus,
  SubmitCoOpClaimInput,
} from '@/tree/partners/types';
import { auditCoOpClaimInvoice } from './heuristic-scorer';
import type { InvoiceAppraisalInput, SubmitCoOpClaimResult } from './types';

/**
 * Submits a Co-Op marketing claim, checks solvency against active budget allocations,
 * performs automated invoice appraisal, and records the claim.
 */
export async function submitCoOpClaim(
  db: D1Database,
  input: SubmitCoOpClaimInput & {
    vendorName?: string;
    brandKeywords?: string[];
    periodStart?: number;
    periodEnd?: number;
    notes?: string;
    isWhitelistedVendor?: boolean;
  },
): Promise<SubmitCoOpClaimResult> {
  const partnerId = input.partnerId?.trim();
  const invoiceNumber = input.invoiceNumber?.trim();
  const invoiceUrl = input.invoiceUrl?.trim();
  const requestedCents = Math.floor(input.requestedAmountCents);

  if (!partnerId || !invoiceNumber || !invoiceUrl) {
    return { success: false, error: 'MISSING_REQUIRED_CLAIM_FIELDS' };
  }

  if (requestedCents <= 0 || !Number.isFinite(requestedCents)) {
    return { success: false, error: 'INVALID_CLAIM_AMOUNT' };
  }

  // 1. Verify partner exists and is active
  const partner = await db
    .prepare('SELECT id, partner_name, tier, status FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerProfile>();

  if (!partner) {
    return { success: false, error: 'PARTNER_NOT_FOUND' };
  }

  if (partner.status !== 'active') {
    return {
      success: false,
      error: partner.status === 'suspended' ? 'PARTNER_SUSPENDED' : 'PARTNER_NOT_ACTIVE',
    };
  }

  // 2. Idempotency Check: Reject duplicate invoice submission per partner
  const duplicate = await db
    .prepare('SELECT id FROM partner_co_op_claims WHERE partner_id = ? AND invoice_number = ?')
    .bind(partnerId, invoiceNumber)
    .first<{ id: string }>();

  if (duplicate) {
    return { success: false, error: 'DUPLICATE_INVOICE_SUBMISSION' };
  }

  // 3. Solvency Check: Find active, non-expired budget allocations for this partner
  const now = Date.now();
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
    return { success: false, error: 'INSUFFICIENT_CO_OP_BUDGET' };
  }

  // Pick target allocation (earliest expiring with capacity, or first active)
  const targetAlloc =
    activeAllocations.find((a) => a.remaining_cents >= requestedCents) ?? activeAllocations[0];

  // 4. Run automated invoice appraisal scoring
  const appraisalInput: InvoiceAppraisalInput = {
    vendorName: input.vendorName,
    invoiceNumber: input.invoiceNumber,
    invoiceUrl: input.invoiceUrl,
    invoiceDate: input.invoiceDate,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    requestedAmountCents: requestedCents,
    availableBudgetCents: totalAvailableCents,
    campaignName: input.campaignName,
    brandKeywords: input.brandKeywords,
    notes: input.notes,
    isWhitelistedVendor: input.isWhitelistedVendor,
  };

  const auditResult = auditCoOpClaimInvoice(appraisalInput);
  const claimId = auditResult.claimId;
  const status: CoOpClaimStatus = auditResult.isAutoApproved ? 'approved' : 'under_review';
  const approvedAmountCents = auditResult.isAutoApproved ? requestedCents : 0;

  // 5. If auto-approved, deduct budget atomically from target allocation
  if (auditResult.isAutoApproved && targetAlloc) {
    await db
      .prepare(`
        UPDATE co_op_budget_allocations
        SET claimed_cents = claimed_cents + ?1,
            remaining_cents = remaining_cents - ?1,
            status = CASE WHEN remaining_cents - ?1 <= 0 THEN 'exhausted' ELSE 'active' END,
            updated_at = ?2
        WHERE id = ?3 AND remaining_cents >= ?1
      `)
      .bind(requestedCents, now, targetAlloc.id)
      .run();
  }

  // 6. Record claim entry in partner_co_op_claims
  await db
    .prepare(`
      INSERT INTO partner_co_op_claims (
        id, partner_id, budget_allocation_id, campaign_name, claim_type,
        invoice_number, invoice_url, invoice_date, requested_amount_cents,
        approved_amount_cents, reimbursement_currency, status, audit_score,
        audit_notes_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      claimId,
      partnerId,
      targetAlloc?.id ?? null,
      input.campaignName,
      input.claimType,
      invoiceNumber,
      invoiceUrl,
      input.invoiceDate,
      requestedCents,
      approvedAmountCents,
      input.reimbursementCurrency ?? 'USDT',
      status,
      auditResult.auditScore,
      JSON.stringify(auditResult.notes),
      now,
      now,
    )
    .run();

  const createdClaim: PartnerCoOpClaim = {
    id: claimId,
    partner_id: partnerId,
    budget_allocation_id: targetAlloc?.id ?? null,
    campaign_name: input.campaignName,
    claim_type: input.claimType,
    invoice_number: invoiceNumber,
    invoice_url: invoiceUrl,
    invoice_date: input.invoiceDate,
    requested_amount_cents: requestedCents,
    approved_amount_cents: approvedAmountCents,
    reimbursement_currency: input.reimbursementCurrency ?? 'USDT',
    status,
    audit_score: auditResult.auditScore,
    audit_notes_json: JSON.stringify(auditResult.notes),
    rejection_reason: null,
    payout_batch_id: null,
    reviewed_by: auditResult.isAutoApproved ? 'SYSTEM_AUTO_APPRAISER' : null,
    reviewed_at: auditResult.isAutoApproved ? now : null,
    paid_at: null,
    created_at: now,
    updated_at: now,
  };

  return {
    success: true,
    claim: createdClaim,
    auditResult,
  };
}
