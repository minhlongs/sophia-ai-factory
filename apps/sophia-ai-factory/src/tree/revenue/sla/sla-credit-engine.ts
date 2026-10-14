/**
 * Enterprise SLA Evaluation & Ledger Persistence Engine
 *
 * @module tree/revenue/sla/sla-credit-engine
 */

import {
  GATE_8_CONSTANTS,
  type EnterpriseSlaEvaluation,
  type EvaluateSlaInput,
  type SlaPenaltyStatus,
} from './types';
import {
  calculatePenaltyCreditCents,
  calculateUptimeMetrics,
  determineSlaBreachLevel,
} from './uptime-calculator';

export {
  saveSlaEvaluation,
  getSlaEvaluationByTenant,
  getSlaLedgerByTenant,
  updateSlaPenaltyStatus,
} from './sla-credit-helpers';

/**
 * Fully evaluates enterprise tenant SLA uptime for a billing period.
 */
export function evaluateEnterpriseSla(
  input: EvaluateSlaInput & { id?: string; targetSlaPct?: number },
): EnterpriseSlaEvaluation {
  const totalPeriodSeconds = input.totalPeriodSeconds ?? GATE_8_CONSTANTS.MONTHLY_PERIOD_SECONDS;
  const metrics = calculateUptimeMetrics(input.downtimeSeconds, totalPeriodSeconds);
  const { breachLevel, penaltyCreditPct } = determineSlaBreachLevel(
    metrics.actualUptimePct,
    input.downtimeSeconds,
    metrics.errorBudgetAllocatedSeconds,
  );

  const penaltyCreditCents = calculatePenaltyCreditCents(
    input.monthlyContractCents,
    penaltyCreditPct,
  );

  const penaltyStatus: SlaPenaltyStatus = breachLevel === 'none' ? 'none' : 'pending_approval';
  const now = Date.now();
  const id =
    input.id ??
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `sla_${now}_${Math.random().toString(36).substring(2, 9)}`);

  return {
    id,
    tenantId: input.tenantId,
    contractId: input.contractId,
    billingPeriod: input.billingPeriod,
    targetSlaPct: input.targetSlaPct ?? GATE_8_CONSTANTS.FIVE_NINES_SLA_PCT,
    actualUptimePct: metrics.actualUptimePct,
    totalPeriodSeconds,
    downtimeSeconds: input.downtimeSeconds,
    errorBudgetAllocatedSeconds: metrics.errorBudgetAllocatedSeconds,
    errorBudgetConsumedSeconds: metrics.errorBudgetConsumedSeconds,
    errorBudgetRemainingSeconds: metrics.errorBudgetRemainingSeconds,
    breachLevel,
    penaltyCreditPct,
    penaltyCreditCents,
    penaltyStatus,
    incidentIds: input.incidentIds ?? [],
    evaluatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
