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

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ActionResult,
  EnterpriseSlaEvaluation,
  EvaluateSlaInput,
} from '@/seed/types/unified-revenue';
import {
  evaluateEnterpriseSla,
  getSlaEvaluationByTenant,
  getSlaLedgerByTenant,
  saveSlaEvaluation,
  updateSlaPenaltyStatus,
} from '@/tree/revenue/sla-uptime-engine';

function getCurrentPeriodMonth(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Fetches the SLA evaluation and error budget status for a given enterprise tenant.
 */
export async function getEnterpriseSlaStatusAction(
  tenantId: string,
  billingPeriod?: string,
): Promise<ActionResult<EnterpriseSlaEvaluation>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    if (!tenantId) {
      return { success: false, error: 'VALIDATION_ERROR: tenantId is required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const period = billingPeriod || getCurrentPeriodMonth();
    let evaluation = await getSlaEvaluationByTenant(db, tenantId, period);

    if (!evaluation) {
      // Default baseline: zero downtime month (100% uptime, 25.92s budget remaining)
      evaluation = evaluateEnterpriseSla({
        tenantId,
        contractId: `contract_${tenantId}`,
        billingPeriod: period,
        monthlyContractCents: 500_000, // $5,000 baseline enterprise tier
        downtimeSeconds: 0,
      });
      await saveSlaEvaluation(db, evaluation);
    }

    return { success: true, data: evaluation };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[sla-management-actions] getEnterpriseSlaStatusAction error', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Evaluates tenant SLA uptime, determines breach level, and saves evaluation to D1.
 */
export async function evaluateTenantSlaAction(
  input: EvaluateSlaInput,
): Promise<ActionResult<EnterpriseSlaEvaluation>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    if (!input.tenantId || !input.contractId || !input.billingPeriod) {
      return { success: false, error: 'VALIDATION_ERROR: Missing required fields' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const evaluation = evaluateEnterpriseSla(input);
    const saved = await saveSlaEvaluation(db, evaluation);

    return { success: true, data: saved };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[sla-management-actions] evaluateTenantSlaAction error', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Approves an SLA penalty credit voucher.
 */
export async function approveSlaPenaltyCreditAction(
  slaLedgerId: string,
): Promise<ActionResult<{ ledgerId: string; status: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    if (!slaLedgerId) {
      return { success: false, error: 'VALIDATION_ERROR: slaLedgerId is required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const updated = await updateSlaPenaltyStatus(db, slaLedgerId, 'credited');
    if (!updated) {
      return { success: false, error: 'RECORD_NOT_FOUND: SLA ledger record not found' };
    }

    return { success: true, data: { ledgerId: slaLedgerId, status: 'credited' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[sla-management-actions] approveSlaPenaltyCreditAction error', { error: message });
    return { success: false, error: message };
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
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    if (!tenantId) {
      return { success: false, error: 'VALIDATION_ERROR: tenantId is required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const history = await getSlaLedgerByTenant(db, tenantId, limit);
    return { success: true, data: history };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[sla-management-actions] listTenantSlaHistoryAction error', { error: message });
    return { success: false, error: message };
  }
}
