/**
 * Automated Heuristic Appraisal Scorer for Co-Op Marketing Invoices
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/heuristic-scorer
 */

import type { AuditCoOpClaimResult } from '@/tree/partners/types';
import {
  AUTO_APPROVAL_SCORE_THRESHOLD,
  AUTO_APPROVAL_MAX_AMOUNT_CENTS,
} from './constants';
import {
  auditVendorCriterion,
  auditDateCriterion,
  auditProofCriterion,
  auditBudgetCriterion,
} from './heuristic-criteria';
import type { InvoiceAppraisalInput } from './types';

/**
 * Automated Heuristic Appraisal Scoring for Co-Op Marketing Invoices (0 - 100 points).
 *
 * Scoring breakdown (4 criteria, 25 points each):
 * 1. Vendor Whitelist (25 points): Known ad network or corporate marketing agency.
 * 2. Date Alignment (25 points): Invoice date within billing cycle + 15 days grace.
 * 3. Proof of Execution & Brand Keywords (25 points): R2/file proof with Sophia brand alignment.
 * 4. Budget Solvency (25 points): Requested claim <= available uncommitted Co-Op budget.
 *
 * Auto-approval Gate:
 * - Score >= 85 AND Requested Amount <= $2,000 (200,000 cents) -> Auto-approved.
 * - Otherwise -> Routed to 'under_review' for manual compliance audit.
 */
export function auditCoOpClaimInvoice(input: InvoiceAppraisalInput): AuditCoOpClaimResult {
  const notes: string[] = [];
  const claimId = input.claimId ?? `claim_${crypto.randomUUID().slice(0, 16)}`;
  const now = Date.now();

  const vendorVerified = auditVendorCriterion(input, notes);
  const dateValid = auditDateCriterion(input, now, notes);
  const proofProvided = auditProofCriterion(input, notes);

  const requestedCents = Math.floor(input.requestedAmountCents);
  const availableCents = Math.floor(input.availableBudgetCents);
  const budgetSufficient = auditBudgetCriterion(requestedCents, availableCents, notes);

  const auditScore =
    (vendorVerified ? 25 : 0) +
    (dateValid ? 25 : 0) +
    (proofProvided ? 25 : 0) +
    (budgetSufficient ? 25 : 0);

  const amountEligible = requestedCents <= AUTO_APPROVAL_MAX_AMOUNT_CENTS;
  const isAutoApproved = auditScore >= AUTO_APPROVAL_SCORE_THRESHOLD && amountEligible && budgetSufficient;

  if (isAutoApproved) {
    notes.push('Auto-approval criteria met: Score >= 85 and Amount <= $2,000.');
  } else if (!amountEligible) {
    notes.push('Amount exceeds $2,000 threshold: escalated to manual compliance review.');
  } else {
    notes.push('Score below 85 threshold: routed to manual compliance review.');
  }

  return {
    claimId,
    auditScore,
    isAutoApproved,
    approvedAmountCents: isAutoApproved ? requestedCents : 0,
    breakdown: {
      vendorVerified,
      dateValid,
      proofProvided,
      budgetSufficient,
    },
    notes,
  };
}
