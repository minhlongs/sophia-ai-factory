/**
 * Co-Op Marketing Claim Submission & Validation Engine
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/claim-submission
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  CoOpClaimStatus,
  SubmitCoOpClaimInput,
} from '@/tree/partners/types';
import { auditCoOpClaimInvoice } from './heuristic-scorer';
import type { InvoiceAppraisalInput, SubmitCoOpClaimResult } from './types';
import { persistCoOpClaimAndDeductBudget } from './claim-submission-persistence';
import { validateClaimPartnerAndBudget } from './claim-submission-validator';

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

  const now = Date.now();
  const validation = await validateClaimPartnerAndBudget(
    db,
    partnerId,
    invoiceNumber,
    requestedCents,
    now,
  );

  if (validation.errorResult || !validation.context) {
    return validation.errorResult ?? { success: false, error: 'INSUFFICIENT_CO_OP_BUDGET' };
  }

  const { targetAlloc, totalAvailableCents } = validation.context;

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

  const createdClaim = await persistCoOpClaimAndDeductBudget({
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
  });

  return {
    success: true,
    claim: createdClaim,
    auditResult,
  };
}
