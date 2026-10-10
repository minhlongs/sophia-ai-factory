/**
 * Uptime Calculator and SLA Breach Determination
 *
 * @module tree/revenue/sla/uptime-calculator
 */

import {
  GATE_8_CONSTANTS,
  type SlaBreachLevel,
} from './types';

/**
 * Calculates five-nines uptime percentage and error budget consumption.
 */
export function calculateUptimeMetrics(
  downtimeSeconds: number,
  totalPeriodSeconds: number = GATE_8_CONSTANTS.MONTHLY_PERIOD_SECONDS,
): {
  actualUptimePct: number;
  errorBudgetAllocatedSeconds: number;
  errorBudgetConsumedSeconds: number;
  errorBudgetRemainingSeconds: number;
  errorBudgetBurnRatePct: number;
} {
  const sanitizedDowntime = Math.max(0, downtimeSeconds);
  const totalSeconds = Math.max(1, totalPeriodSeconds);

  // Five Nines error budget: 25.92 seconds in a 30-day month (2,592,000 * 0.00001)
  const errorBudgetAllocatedSeconds = Number(
    ((1 - GATE_8_CONSTANTS.FIVE_NINES_SLA_PCT / 100) * totalSeconds).toFixed(2),
  );

  const uptimeSeconds = Math.max(0, totalSeconds - sanitizedDowntime);
  const actualUptimePct = Number(((uptimeSeconds / totalSeconds) * 100).toFixed(5));

  const errorBudgetConsumedSeconds = Number(sanitizedDowntime.toFixed(2));
  const errorBudgetRemainingSeconds = Number(
    Math.max(0, errorBudgetAllocatedSeconds - sanitizedDowntime).toFixed(2),
  );

  const errorBudgetBurnRatePct = errorBudgetAllocatedSeconds > 0
    ? Number(((sanitizedDowntime / errorBudgetAllocatedSeconds) * 100).toFixed(2))
    : 0;

  return {
    actualUptimePct,
    errorBudgetAllocatedSeconds,
    errorBudgetConsumedSeconds,
    errorBudgetRemainingSeconds,
    errorBudgetBurnRatePct,
  };
}

/**
 * Determines SLA breach tier and penalty credit percentage.
 */
export function determineSlaBreachLevel(
  actualUptimePct: number,
  downtimeSeconds: number,
  errorBudgetAllocatedSeconds: number = GATE_8_CONSTANTS.FIVE_NINES_MONTHLY_ERROR_BUDGET_SECONDS,
): {
  breachLevel: SlaBreachLevel;
  penaltyCreditPct: number;
} {
  if (downtimeSeconds <= errorBudgetAllocatedSeconds) {
    return { breachLevel: 'none', penaltyCreditPct: 0.0 };
  }

  // Minor breach: > 25.92s and <= 259.2s (Four Nines tier: 99.99%)
  if (downtimeSeconds <= errorBudgetAllocatedSeconds * 10) {
    return { breachLevel: 'minor', penaltyCreditPct: 10.0 };
  }

  // Moderate breach: > 259.2s and <= 2592s (Three Nines tier: 99.90%)
  if (downtimeSeconds <= errorBudgetAllocatedSeconds * 100) {
    return { breachLevel: 'moderate', penaltyCreditPct: 25.0 };
  }

  // Critical breach: > 2592s (~43.2 minutes)
  const penaltyCreditPct = actualUptimePct < 99.0 ? 100.0 : 50.0;
  return { breachLevel: 'critical', penaltyCreditPct };
}

/**
 * Calculates the exact dollar penalty credit in integer cents.
 */
export function calculatePenaltyCreditCents(
  monthlyContractCents: number,
  penaltyCreditPct: number,
): number {
  if (monthlyContractCents <= 0 || penaltyCreditPct <= 0) return 0;
  return Math.round((monthlyContractCents * penaltyCreditPct) / 100);
}
