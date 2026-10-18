/**
 * Co-Op Marketing Invoice Appraisal Criteria Evaluators
 *
 * Layer: tree
 * @module tree/partners/co-op/heuristic-criteria
 */

import {
  CO_OP_BUDGET_EXPIRY_MS,
  CO_OP_GRACE_PERIOD_MS,
  VERIFIED_AD_NETWORKS,
  SOPHIA_BRAND_KEYWORDS,
} from './constants';
import type { InvoiceAppraisalInput } from './types';

export function auditVendorCriterion(input: InvoiceAppraisalInput, notes: string[]): boolean {
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

export function auditDateCriterion(input: InvoiceAppraisalInput, now: number, notes: string[]): boolean {
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

export function auditProofCriterion(input: InvoiceAppraisalInput, notes: string[]): boolean {
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

export function auditBudgetCriterion(requestedCents: number, availableCents: number, notes: string[]): boolean {
  const budgetSufficient = requestedCents > 0 && requestedCents <= availableCents;
  notes.push(
    budgetSufficient
      ? `Budget solvent: requested $${(requestedCents / 100).toFixed(2)} <= available $${(availableCents / 100).toFixed(2)}.`
      : `Budget insolvent: requested $${(requestedCents / 100).toFixed(2)} > available $${(availableCents / 100).toFixed(2)} (-25 pts).`,
  );
  return budgetSufficient;
}
