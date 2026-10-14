/**
 * Enterprise SLA Management Helpers
 *
 * Layer: land/sla (Helpers - imports only from @/seed and @/tree)
 *
 * @module land/sla/sla-management-helpers
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ActionResult,
  EnterpriseSlaEvaluation,
} from '@/seed/types/unified-revenue';
import {
  evaluateEnterpriseSla,
  getSlaEvaluationByTenant,
  saveSlaEvaluation,
} from '@/tree/revenue/sla-uptime-engine';

export type SlaDbClient = NonNullable<Awaited<ReturnType<typeof getD1>>>;

export function getCurrentPeriodMonth(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function validateAndGetSlaDb(
  isValidInput: boolean,
  validationError: string,
): Promise<{ ok: true; db: SlaDbClient } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: 'UNAUTHORIZED: Authentication required' };
  }

  if (!isValidInput) {
    return { ok: false, error: validationError };
  }

  const db = await getD1();
  if (!db) {
    return { ok: false, error: 'Database unavailable' };
  }

  return { ok: true, db };
}

export async function fetchOrCreateSlaEvaluation(
  db: SlaDbClient,
  tenantId: string,
  billingPeriod?: string,
): Promise<EnterpriseSlaEvaluation> {
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

  return evaluation;
}

export function handleSlaActionError<T>(
  actionName: string,
  error: unknown,
): ActionResult<T> {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`[sla-management-actions] ${actionName} error`, { error: message });
  return { success: false, error: message };
}
