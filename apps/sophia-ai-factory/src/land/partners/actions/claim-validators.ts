/**
 * Co-Op Marketing Claim Input & Ownership Validation Helpers
 *
 * Layer: land
 *
 * @module land/partners/actions/claim-validators
 */

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import type { SubmitCoOpClaimInput } from '@/tree/partners/types';
import { verifyPartnerOwnership } from './ownership-verifier';
import type {
  SubmitClaimActionInput,
  CoOpActionError,
} from './types';

export type NormalizedSubmitCoOpClaimInput = SubmitCoOpClaimInput & {
  vendorName?: string;
  brandKeywords?: string[];
  periodStart?: number;
  periodEnd?: number;
  notes?: string;
};

export async function validateSubmitClaimAccess(
  input: SubmitClaimActionInput,
): Promise<Result<{ db: D1Database; claimInput: NormalizedSubmitCoOpClaimInput }, CoOpActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to submit Co-Op claims' });
  }

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
  }

  const partnerId = input.partnerId?.trim();
  const invoiceNumber = input.invoiceNumber?.trim();
  const invoiceUrl = input.invoiceUrl?.trim();

  if (!partnerId || !invoiceNumber || !invoiceUrl) {
    return failure({ code: 'INVALID_INPUT', message: 'partnerId, invoiceNumber, and invoiceUrl are required' });
  }

  const authCheck = await verifyPartnerOwnership(db, partnerId, user.id, user.role);
  if (!authCheck.ok) {
    return failure(authCheck.error);
  }

  return success({
    db,
    claimInput: {
      partnerId,
      campaignName: input.campaignName,
      claimType: input.claimType,
      invoiceNumber,
      invoiceUrl,
      invoiceDate: input.invoiceDate,
      requestedAmountCents: input.requestedAmountCents,
      reimbursementCurrency: input.reimbursementCurrency ?? 'USDT',
      vendorName: input.vendorName,
      brandKeywords: input.brandKeywords,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      notes: input.notes,
    },
  });
}

export async function resolveDisburseClaimAccess(
  claimId: string,
  partnerId?: string,
): Promise<Result<{ trimmedClaimId: string }, CoOpActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to disburse approved claim' });
  }

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
  }

  const trimmedClaimId = claimId?.trim();
  if (!trimmedClaimId) {
    return failure({ code: 'INVALID_INPUT', message: 'claimId is required' });
  }

  let targetPartnerId = partnerId?.trim();
  if (!targetPartnerId) {
    const claimRow = await db
      .prepare('SELECT partner_id FROM partner_co_op_claims WHERE id = ?')
      .bind(trimmedClaimId)
      .first<{ partner_id: string }>();
    if (!claimRow) {
      return failure({ code: 'CLAIM_NOT_FOUND', message: 'Claim not found' });
    }
    targetPartnerId = claimRow.partner_id;
  }

  const authCheck = await verifyPartnerOwnership(db, targetPartnerId, user.id, user.role);
  if (!authCheck.ok) {
    return failure(authCheck.error);
  }

  return success({ trimmedClaimId });
}
