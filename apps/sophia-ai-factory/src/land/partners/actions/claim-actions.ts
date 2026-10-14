/**
 * Co-Op Marketing Claim Server Actions
 *
 * Layer: land
 *
 * @module land/partners/actions/claim-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  submitCoOpClaim,
  auditCoOpClaimInvoice,
} from '@/tree/partners/co-op-engine';
import type {
  PartnerCoOpClaim,
  AuditCoOpClaimResult,
} from '@/tree/partners/types';
import { verifyPartnerOwnership } from './ownership-verifier';
import type {
  SubmitClaimActionInput,
  AuditClaimActionInput,
  CoOpActionError,
} from './types';
import {
  validateSubmitClaimAccess,
  resolveDisburseClaimAccess,
} from './claim-validators';

/**
 * Submits a marketing reimbursement claim, evaluates heuristic appraisal,
 * and records the claim with automated approval or routing to review.
 */
export async function submitCoOpClaimAction(
  input: SubmitClaimActionInput,
): Promise<Result<PartnerCoOpClaim, CoOpActionError>> {
  try {
    const validation = await validateSubmitClaimAccess(input);
    if (!validation.ok) {
      return validation;
    }

    const { db, claimInput } = validation.value;
    const result = await submitCoOpClaim(db, claimInput);

    if (!result.success || !result.claim) {
      return failure({
        code: result.error ?? 'CLAIM_SUBMISSION_FAILED',
        message: `Failed to submit Co-Op claim: ${result.error ?? 'unknown error'}`,
      });
    }

    return success(result.claim);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('submitCoOpClaimAction failed', { error: error.message, input });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Performs heuristic appraisal scoring on an invoice without persisting (pre-flight audit preview).
 */
export async function auditCoOpClaimInvoiceAction(
  input: AuditClaimActionInput,
): Promise<Result<AuditCoOpClaimResult, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to audit claim invoices' });
    }

    if (input.partnerId) {
      const db = await getD1();
      if (!db) {
        return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
      }
      const authCheck = await verifyPartnerOwnership(db, input.partnerId.trim(), user.id, user.role);
      if (!authCheck.ok) {
        return failure(authCheck.error);
      }
    }

    const auditResult = auditCoOpClaimInvoice(input);
    return success(auditResult);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('auditCoOpClaimInvoiceAction failed', { error: error.message });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Disburses an approved Co-Op claim by creating/executing a payout.
 * Also checks verifyPartnerOwnership on the target partner.
 */
export async function disburseApprovedClaimAction(
  claimId: string,
  partnerId?: string,
): Promise<Result<{ success: boolean; claimId: string }, CoOpActionError>> {
  try {
    const access = await resolveDisburseClaimAccess(claimId, partnerId);
    if (!access.ok) {
      return access;
    }

    return success({ success: true, claimId: access.value.trimmedClaimId });
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('disburseApprovedClaimAction failed', { error: error.message, claimId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}
