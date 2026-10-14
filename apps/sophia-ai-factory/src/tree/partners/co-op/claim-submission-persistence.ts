/**
 * Persistence helpers for Co-Op marketing claim submission.
 * @module tree/partners/co-op/claim-submission-persistence
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  CoOpBudgetAllocation,
  PartnerCoOpClaim,
  CoOpClaimStatus,
  SubmitCoOpClaimInput,
  AuditCoOpClaimResult,
} from '@/tree/partners/types';

export async function persistCoOpClaimAndDeductBudget(params: {
  db: D1Database;
  claimId: string;
  partnerId: string;
  targetAlloc: CoOpBudgetAllocation | undefined;
  input: SubmitCoOpClaimInput;
  invoiceNumber: string;
  invoiceUrl: string;
  requestedCents: number;
  approvedAmountCents: number;
  status: CoOpClaimStatus;
  auditResult: AuditCoOpClaimResult;
  now: number;
}): Promise<PartnerCoOpClaim> {
  const {
    db,
    claimId,
    partnerId,
    targetAlloc,
    input,
    invoiceNumber,
    invoiceUrl,
    requestedCents,
    approvedAmountCents,
    status,
    auditResult,
    now,
  } = params;

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

  return {
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
}
