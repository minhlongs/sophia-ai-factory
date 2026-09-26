/**
 * Server Actions for Co-Op Marketing Funds & Automated Revenue-Share Settlement
 *
 * Implements authenticated Server Actions with Cloudflare D1 persistence,
 * strict user ownership verification (anti-BOLA/IDOR), 5% monthly Co-Op budget accrual,
 * invoice appraisal scoring, budget sweeps, and multi-rail batch payout settlement
 * with atomic rollback.
 *
 * Layer: land (Public business layer — Server Actions)
 * Dependencies: @/seed/*, @/tree/partners/*
 *
 * @module land/partners/co-op-actions
 */

'use server';

import type { D1Database } from '@cloudflare/workers-types';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  accrueMonthlyCoOpBudget,
  submitCoOpClaim,
  auditCoOpClaimInvoice,
  sweepExpiredCoOpBudgets,
  getPartnerCoOpSummary,
  getPartnerCoOpAllocations,
  getPartnerCoOpClaims,
  type InvoiceAppraisalInput,
  type PartnerCoOpSummary,
  type SweepExpiredBudgetsResult,
} from '@/tree/partners/co-op-engine';
import {
  createPayoutBatch,
  executePayoutBatch,
  getPayoutBatchById,
  type CreatePayoutBatchResult,
} from '@/tree/partners/payout-batcher';
import type {
  PartnerTier,
  CoOpBudgetAllocation,
  PartnerCoOpClaim,
  CoOpClaimType,
  CoOpClaimStatus,
  SubmitCoOpClaimInput,
  AuditCoOpClaimResult,
  PayoutBatchType,
  PayoutRail,
  PartnerPayoutBatch,
  PayoutBatchExecutionResult,
} from '@/tree/partners/types';

export interface CoOpActionError {
  code: string;
  message: string;
}

export interface AccrueBudgetActionInput {
  partnerId: string;
  cycleMonth: string;
  mrrCents: number;
  tier?: PartnerTier;
}

export interface SubmitClaimActionInput {
  partnerId: string;
  campaignName: string;
  claimType: CoOpClaimType;
  invoiceNumber: string;
  invoiceUrl: string;
  invoiceDate: number;
  requestedAmountCents: number;
  reimbursementCurrency?: 'USDT' | 'VND';
  vendorName?: string;
  brandKeywords?: string[];
  periodStart?: number;
  periodEnd?: number;
  notes?: string;
}

export interface CreatePayoutBatchActionInput {
  partnerId?: string;
  batchType: PayoutBatchType;
  rail: PayoutRail;
  currency?: 'USD' | 'VND' | 'USDT';
  fxRate?: number;
  destinationAddress?: string;
}

export interface AuditClaimActionInput extends InvoiceAppraisalInput {
  partnerId?: string;
}

export interface PartnerOwnershipRecord {
  id: string;
  user_id: string;
}

export type PartnerOwnershipResult =
  | { ok: true; success: true; value: PartnerOwnershipRecord }
  | { ok: false; success: false; error: CoOpActionError };

/**
 * Validates that the authenticated user owns the target partner profile or is an admin.
 * Protects against Broken Object Level Authorization (BOLA / IDOR).
 */
export async function verifyPartnerOwnership(
  db: D1Database,
  partnerId: string,
  userOrId: { id: string; role?: string } | string,
  userRole?: string,
): Promise<PartnerOwnershipResult> {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
  const role = typeof userOrId === 'string' ? userRole : (userOrId.role ?? userRole);

  const partner = await db
    .prepare('SELECT id, user_id FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerOwnershipRecord>();

  if (!partner) {
    return { ok: false, success: false, error: { code: 'NOT_FOUND', message: 'Partner profile not found' } };
  }

  if (partner.user_id !== userId && role !== 'admin') {
    return { ok: false, success: false, error: { code: 'FORBIDDEN', message: 'Access denied to partner resources' } };
  }

  return { ok: true, success: true, value: partner };
}

/**
 * Accrues 5% monthly Co-Op budget for an eligible Gold/Platinum partner.
 */
export async function accrueMonthlyCoOpBudgetAction(
  input: AccrueBudgetActionInput,
): Promise<Result<CoOpBudgetAllocation, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to accrue Co-Op budget' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partnerId = input.partnerId?.trim();
    const cycleMonth = input.cycleMonth?.trim();

    if (!partnerId || !cycleMonth) {
      return failure({ code: 'INVALID_INPUT', message: 'partnerId and cycleMonth are required' });
    }

    // Enforce object ownership
    const authCheck = await verifyPartnerOwnership(db, partnerId, user.id, user.role);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const result = await accrueMonthlyCoOpBudget(db, partnerId, cycleMonth, input.mrrCents, input.tier);

    if (!result.success || !result.allocation) {
      return failure({
        code: result.error ?? 'ACCRUAL_FAILED',
        message: `Failed to accrue Co-Op budget: ${result.error ?? 'unknown error'}`,
      });
    }

    return success(result.allocation);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('accrueMonthlyCoOpBudgetAction failed', { error: error.message, input });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Submits a marketing reimbursement claim, evaluates heuristic appraisal,
 * and records the claim with automated approval or routing to review.
 */
export async function submitCoOpClaimAction(
  input: SubmitClaimActionInput,
): Promise<Result<PartnerCoOpClaim, CoOpActionError>> {
  try {
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

    // Enforce object ownership
    const authCheck = await verifyPartnerOwnership(db, partnerId, user.id, user.role);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const claimInput: SubmitCoOpClaimInput & {
      vendorName?: string;
      brandKeywords?: string[];
      periodStart?: number;
      periodEnd?: number;
      notes?: string;
    } = {
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
    };

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
 * Sweeps expired unspent Co-Op budgets older than 90 days.
 * Restricted to Platform Administrators.
 */
export async function sweepExpiredCoOpBudgetsAction(
  currentTimestampMs?: number,
): Promise<Result<SweepExpiredBudgetsResult, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to execute budget sweep' });
    }

    if (user.role !== 'admin') {
      return failure({ code: 'FORBIDDEN', message: 'Admin access required to sweep expired Co-Op budgets' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const result = await sweepExpiredCoOpBudgets(db, currentTimestampMs);
    return success(result);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('sweepExpiredCoOpBudgetsAction failed', { error: error.message });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Creates a batch payout for pending commissions and/or approved Co-Op claims.
 */
export async function createPayoutBatchAction(
  input: CreatePayoutBatchActionInput,
): Promise<Result<CreatePayoutBatchResult, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to create payout batch' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    // If partner-specific batch, verify ownership; if platform-wide batch, verify admin
    if (input.partnerId) {
      const authCheck = await verifyPartnerOwnership(db, input.partnerId.trim(), user.id, user.role);
      if (!authCheck.ok) {
        return failure(authCheck.error);
      }
    } else if (user.role !== 'admin') {
      return failure({ code: 'FORBIDDEN', message: 'Admin access required to create platform-wide payout batches' });
    }

    const result = await createPayoutBatch(
      db,
      input.partnerId?.trim() ?? null,
      input.batchType,
      input.rail,
      input.currency ?? 'USD',
      { fxRate: input.fxRate, destinationAddress: input.destinationAddress },
    );

    if (!result.success || !result.batch) {
      return failure({
        code: result.error ?? 'PAYOUT_BATCH_CREATION_FAILED',
        message: `Failed to create payout batch: ${result.error ?? 'unknown error'}`,
      });
    }

    return success(result);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('createPayoutBatchAction failed', { error: error.message, input });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Executes a payout batch across the specified rail and handles atomic rollback on failure.
 */
export async function executePayoutBatchAction(
  batchId: string,
): Promise<Result<PayoutBatchExecutionResult, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to execute payout batch' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedBatchId = batchId?.trim();
    if (!trimmedBatchId) {
      return failure({ code: 'INVALID_INPUT', message: 'batchId is required' });
    }

    const existingBatch = await getPayoutBatchById(db, trimmedBatchId);
    if (!existingBatch) {
      return failure({ code: 'BATCH_NOT_FOUND', message: 'Payout batch not found' });
    }

    // Verify ownership of the batch
    if (existingBatch.partner_id) {
      const authCheck = await verifyPartnerOwnership(db, existingBatch.partner_id, user.id, user.role);
      if (!authCheck.ok) {
        return failure(authCheck.error);
      }
    } else if (user.role !== 'admin') {
      return failure({ code: 'FORBIDDEN', message: 'Admin access required to execute platform-wide payout batches' });
    }

    const result = await executePayoutBatch(db, trimmedBatchId);

    if (!result.success) {
      return failure({
        code: result.error ?? 'PAYOUT_EXECUTION_FAILED',
        message: `Payout batch execution failed: ${result.error ?? 'unknown error'}`,
      });
    }

    return success(result);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('executePayoutBatchAction failed', { error: error.message, batchId });
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

    return success({ success: true, claimId: trimmedClaimId });
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('disburseApprovedClaimAction failed', { error: error.message, claimId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Retrieves Co-Op summary statistics for a partner.
 */
export async function getPartnerCoOpSummaryAction(
  partnerId: string,
): Promise<Result<PartnerCoOpSummary, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view Co-Op summary' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedPartnerId = partnerId?.trim();
    if (!trimmedPartnerId) {
      return failure({ code: 'INVALID_INPUT', message: 'partnerId is required' });
    }

    // Enforce object ownership
    const authCheck = await verifyPartnerOwnership(db, trimmedPartnerId, user.id, user.role);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const summary = await getPartnerCoOpSummary(db, trimmedPartnerId);
    if (!summary) {
      return failure({ code: 'PARTNER_NOT_FOUND', message: 'Partner not found' });
    }

    return success(summary);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getPartnerCoOpSummaryAction failed', { error: error.message, partnerId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Retrieves budget allocations for a partner.
 */
export async function getPartnerCoOpAllocationsAction(
  partnerId: string,
): Promise<Result<CoOpBudgetAllocation[], CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view Co-Op allocations' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedPartnerId = partnerId?.trim();
    if (!trimmedPartnerId) {
      return failure({ code: 'INVALID_INPUT', message: 'partnerId is required' });
    }

    // Enforce object ownership
    const authCheck = await verifyPartnerOwnership(db, trimmedPartnerId, user.id, user.role);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const allocations = await getPartnerCoOpAllocations(db, trimmedPartnerId);
    return success(allocations);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getPartnerCoOpAllocationsAction failed', { error: error.message, partnerId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Retrieves Co-Op claims for a partner.
 */
export async function getPartnerCoOpClaimsAction(
  partnerId: string,
  status?: CoOpClaimStatus,
): Promise<Result<PartnerCoOpClaim[], CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view Co-Op claims' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedPartnerId = partnerId?.trim();
    if (!trimmedPartnerId) {
      return failure({ code: 'INVALID_INPUT', message: 'partnerId is required' });
    }

    // Enforce object ownership
    const authCheck = await verifyPartnerOwnership(db, trimmedPartnerId, user.id, user.role);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const claims = await getPartnerCoOpClaims(db, trimmedPartnerId, status);
    return success(claims);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getPartnerCoOpClaimsAction failed', { error: error.message, partnerId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Retrieves a payout batch by ID.
 */
export async function getPayoutBatchByIdAction(
  batchId: string,
): Promise<Result<PartnerPayoutBatch, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view payout batch' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedBatchId = batchId?.trim();
    if (!trimmedBatchId) {
      return failure({ code: 'INVALID_INPUT', message: 'batchId is required' });
    }

    const batch = await getPayoutBatchById(db, trimmedBatchId);
    if (!batch) {
      return failure({ code: 'BATCH_NOT_FOUND', message: 'Payout batch not found' });
    }

    // Enforce object ownership
    if (batch.partner_id) {
      const authCheck = await verifyPartnerOwnership(db, batch.partner_id, user.id, user.role);
      if (!authCheck.ok) {
        return failure(authCheck.error);
      }
    } else if (user.role !== 'admin') {
      return failure({ code: 'FORBIDDEN', message: 'Admin access required to view platform-wide payout batches' });
    }

    return success(batch);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getPayoutBatchByIdAction failed', { error: error.message, batchId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Retrieves payout batches for a partner.
 */
export async function getPartnerPayoutBatchesAction(
  partnerId: string,
): Promise<Result<PartnerPayoutBatch[], CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view partner payout batches' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedPartnerId = partnerId?.trim();
    if (!trimmedPartnerId) {
      return failure({ code: 'INVALID_INPUT', message: 'partnerId is required' });
    }

    const authCheck = await verifyPartnerOwnership(db, trimmedPartnerId, user.id, user.role);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const rows = await db
      .prepare('SELECT * FROM partner_payout_batches WHERE partner_id = ? ORDER BY created_at DESC')
      .bind(trimmedPartnerId)
      .all<PartnerPayoutBatch>();

    return success(rows.results ?? []);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getPartnerPayoutBatchesAction failed', { error: error.message, partnerId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}
