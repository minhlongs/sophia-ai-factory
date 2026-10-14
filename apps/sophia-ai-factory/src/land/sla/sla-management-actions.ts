'use server';

/**
 * Enterprise SLA Management Server Actions
 *
 * Implements:
 * - Enterprise tenant SLA uptime query and error budget inspection
 * - Automated SLA evaluation and penalty credit calculation
 * - SLA penalty credit approval and status transitions
 * - Trailing SLA performance history
 *
 * Layer: land/sla (Server Actions - imports only from @/seed and @/tree)
 *
 * @module land/sla/sla-management-actions
 */

import type {
  ActionResult,
  EnterpriseSlaEvaluation,
  EvaluateSlaInput,
} from '@/seed/types/unified-revenue';
import {
  evaluateEnterpriseSla,
  getSlaLedgerByTenant,
  saveSlaEvaluation,
  updateSlaPenaltyStatus,
} from '@/tree/revenue/sla-uptime-engine';
import {
  fetchOrCreateSlaEvaluation,
  handleSlaActionError,
  validateAndGetSlaDb,
} from './sla-management-helpers';

/**
 * Fetches the SLA evaluation and error budget status for a given enterprise tenant.
 */
export async function getEnterpriseSlaStatusAction(
  tenantId: string,
  billingPeriod?: string,
): Promise<ActionResult<EnterpriseSlaEvaluation>> {
  try {
    const ctx = await validateAndGetSlaDb(
      Boolean(tenantId),
      'VALIDATION_ERROR: tenantId is required',
    );
    if (!ctx.ok) {
      return { success: false, error: ctx.error };
    }

    const evaluation = await fetchOrCreateSlaEvaluation(ctx.db, tenantId, billingPeriod);
    return { success: true, data: evaluation };
  } catch (error) {
    return handleSlaActionError('getEnterpriseSlaStatusAction', error);
  }
}

/**
 * Evaluates tenant SLA uptime, determines breach level, and saves evaluation to D1.
 */
export async function evaluateTenantSlaAction(
  input: EvaluateSlaInput,
): Promise<ActionResult<EnterpriseSlaEvaluation>> {
  try {
    const isValid = Boolean(input.tenantId && input.contractId && input.billingPeriod);
    const ctx = await validateAndGetSlaDb(
      isValid,
      'VALIDATION_ERROR: Missing required fields',
    );
    if (!ctx.ok) {
      return { success: false, error: ctx.error };
    }

    const evaluation = evaluateEnterpriseSla(input);
    const saved = await saveSlaEvaluation(ctx.db, evaluation);

    return { success: true, data: saved };
  } catch (error) {
    return handleSlaActionError('evaluateTenantSlaAction', error);
  }
}

/**
 * Approves an SLA penalty credit voucher.
 */
export async function approveSlaPenaltyCreditAction(
  slaLedgerId: string,
): Promise<ActionResult<{ ledgerId: string; status: string }>> {
  try {
    const ctx = await validateAndGetSlaDb(
      Boolean(slaLedgerId),
      'VALIDATION_ERROR: slaLedgerId is required',
    );
    if (!ctx.ok) {
      return { success: false, error: ctx.error };
    }

    const updated = await updateSlaPenaltyStatus(ctx.db, slaLedgerId, 'credited');
    if (!updated) {
      return { success: false, error: 'RECORD_NOT_FOUND: SLA ledger record not found' };
    }

    return { success: true, data: { ledgerId: slaLedgerId, status: 'credited' } };
  } catch (error) {
    return handleSlaActionError('approveSlaPenaltyCreditAction', error);
  }
}

/**
 * Lists trailing SLA history for an enterprise tenant.
 */
export async function listTenantSlaHistoryAction(
  tenantId: string,
  limit = 12,
): Promise<ActionResult<EnterpriseSlaEvaluation[]>> {
  try {
    const ctx = await validateAndGetSlaDb(
      Boolean(tenantId),
      'VALIDATION_ERROR: tenantId is required',
    );
    if (!ctx.ok) {
      return { success: false, error: ctx.error };
    }

    const history = await getSlaLedgerByTenant(ctx.db, tenantId, limit);
    return { success: true, data: history };
  } catch (error) {
    return handleSlaActionError('listTenantSlaHistoryAction', error);
  }
}
