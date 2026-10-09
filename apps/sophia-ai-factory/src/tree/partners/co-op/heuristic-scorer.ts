/**
 * Automated Heuristic Appraisal Scorer for Co-Op Marketing Invoices
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/heuristic-scorer
 */

import type { AuditCoOpClaimResult } from '@/tree/partners/types';
import {
  CO_OP_BUDGET_EXPIRY_MS,
  CO_OP_GRACE_PERIOD_MS,
  AUTO_APPROVAL_SCORE_THRESHOLD,
  AUTO_APPROVAL_MAX_AMOUNT_CENTS,
  VERIFIED_AD_NETWORKS,
  SOPHIA_BRAND_KEYWORDS,
} from './constants';
import type { InvoiceAppraisalInput } from './types';

function auditVendorCriterion(input: InvoiceAppraisalInput, notes: string[]): boolean {
  if (input.isWhitelistedVendor) {
    notes.push('Vendor explicitly marked whitelisted.');
    return true;
  }
  const vendorCandidate = `${input.vendorName ?? ''} ${input.invoiceUrl ?? ''} ${input.notes ?? ''}`.toLowerCase();
  for (const net of VERIFIED_AD_NETWORKS) {
    if (vendorCandidate.includes(net)) {
      notes.push(`Vendor verified against ad network whitelist: [${net}].`);
      return true;
    }
  }
  notes.push('Vendor not recognized on verified ad network whitelist (-25 pts).');
  return false;
}

function auditDateCriterion(input: InvoiceAppraisalInput, now: number, notes: string[]): boolean {
  const invoiceDate = input.invoiceDate;
  if (input.periodStart && input.periodEnd) {
    const minAllowedDate = input.periodStart - CO_OP_GRACE_PERIOD_MS;
    const maxAllowedDate = input.periodEnd + CO_OP_GRACE_PERIOD_MS;
    const dateValid = invoiceDate >= minAllowedDate && invoiceDate <= maxAllowedDate;
    notes.push(
      dateValid
        ? 'Invoice date falls within billing cycle window (+/- 15-day grace).'
        : 'Invoice date falls outside billing cycle window (-25 pts).',
    );
    return dateValid;
  }
  const maxPastWindow = now - CO_OP_BUDGET_EXPIRY_MS - CO_OP_GRACE_PERIOD_MS;
  const maxFutureWindow = now + 86_400 * 1000;
  const dateValid = invoiceDate >= maxPastWindow && invoiceDate <= maxFutureWindow;
  notes.push(
    dateValid
      ? 'Invoice date within rolling 90-day window.'
      : 'Invoice date expired (>90 days old) or invalid future date (-25 pts).',
  );
  return dateValid;
}

function auditProofCriterion(input: InvoiceAppraisalInput, notes: string[]): boolean {
  const proofUrl = input.proofUrl ?? input.invoiceUrl;
  const hasProofFile = Boolean(proofUrl && proofUrl.trim().length > 5);

  const brandContext = `${input.campaignName ?? ''} ${input.notes ?? ''} ${(input.brandKeywords ?? []).join(' ')}`.toLowerCase();
  let hasBrandKeywords = false;
  for (const kw of SOPHIA_BRAND_KEYWORDS) {
    if (brandContext.includes(kw)) {
      hasBrandKeywords = true;
      break;
    }
  }

  if (hasProofFile && hasBrandKeywords) {
    notes.push('Campaign proof attached and verified with Sophia brand keywords.');
    return true;
  }
  if (!hasProofFile) {
    notes.push('Missing proof of campaign execution / invoice attachment (-25 pts).');
    return false;
  }
  notes.push('Proof attached but lacking required Sophia brand keywords (-25 pts).');
  return false;
}

function auditBudgetCriterion(requestedCents: number, availableCents: number, notes: string[]): boolean {
  const budgetSufficient = requestedCents > 0 && requestedCents <= availableCents;
  notes.push(
    budgetSufficient
      ? `Budget solvent: requested $${(requestedCents / 100).toFixed(2)} <= available $${(availableCents / 100).toFixed(2)}.`
      : `Budget insolvent: requested $${(requestedCents / 100).toFixed(2)} > available $${(availableCents / 100).toFixed(2)} (-25 pts).`,
  );
  return budgetSufficient;
}

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
