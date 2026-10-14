/**
 * Monthly MCU quota and burst capacity evaluation helpers for Agency Quota Engine.
 * @module tree/agy/agency-monthly-quota
 */

import type { QuotaEvaluationResult } from '@/seed/types/agy-multitenancy';

export interface MonthlyQuotaEvaluationInput {
  agencyId: string;
  quotaLimitMcu: number;
  quotaUsedMcu: number;
  requestedMcu?: number;
  allowOverage?: boolean;
}

/**
 * Pure evaluation of monthly MCU quota deficit or surplus.
 */
export function checkMonthlyQuota(input: MonthlyQuotaEvaluationInput): QuotaEvaluationResult {
  const { agencyId, quotaLimitMcu, quotaUsedMcu, allowOverage = false } = input;
  const requestedMcu = Math.max(0, input.requestedMcu ?? 0);

  const safeLimit = Math.max(0, quotaLimitMcu);
  const safeUsed = Math.max(0, quotaUsedMcu);
  const projectedUsed = safeUsed + requestedMcu;

  const remainingMcu = Math.max(0, safeLimit - safeUsed);
  const deficitMcu = Math.max(0, projectedUsed - safeLimit);

  if (projectedUsed <= safeLimit) {
    const isWarning = remainingMcu <= safeLimit * 0.1 && safeLimit > 0;
    return {
      allowed: true,
      agencyId,
      quotaLimitMcu: safeLimit,
      quotaUsedMcu: safeUsed,
      remainingMcu,
      deficitMcu: 0,
      status: isWarning ? 'warning' : 'ok',
    };
  }

  if (allowOverage) {
    return {
      allowed: true,
      agencyId,
      quotaLimitMcu: safeLimit,
      quotaUsedMcu: safeUsed,
      remainingMcu: 0,
      deficitMcu,
      status: 'warning',
      reason: `Overage allowed: deficit of ${deficitMcu} MCU incurred`,
    };
  }

  return {
    allowed: false,
    agencyId,
    quotaLimitMcu: safeLimit,
    quotaUsedMcu: safeUsed,
    remainingMcu: 0,
    deficitMcu,
    status: 'exhausted',
    reason: `Agency monthly quota exceeded. Limit: ${safeLimit} MCU, Used: ${safeUsed} MCU, Requested: ${requestedMcu} MCU`,
  };
}

/**
 * Calculates updated quota usage after an increment or decrement.
 */
export function calculateNextQuotaState(currentUsedMcu: number, deltaMcu: number): number {
  return Math.max(0, Math.round(currentUsedMcu + deltaMcu));
}

/**
 * Evaluates burst allowance for short spikes (e.g. 1.5x standard RPS for up to 5 seconds).
 */
export function evaluateAgencyBurstCapacity(params: {
  currentRps: number;
  rateLimitRps: number;
  burstMultiplier?: number;
}): { allowed: boolean; burstLimit: number; currentRps: number } {
  const multiplier = params.burstMultiplier ?? 1.5;
  const burstLimit = Math.ceil(params.rateLimitRps * multiplier);
  const allowed = params.currentRps <= burstLimit;

  return {
    allowed,
    burstLimit,
    currentRps: params.currentRps,
  };
}
