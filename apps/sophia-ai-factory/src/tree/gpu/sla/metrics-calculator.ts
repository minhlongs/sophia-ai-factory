/**
 * Six-Nines (99.9999%) Uptime & Breach Tier Metrics Calculator
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module tree/gpu/sla/metrics-calculator
 */

import {
  type SixNinesBreachTier,
  type SixNinesSlaMetrics,
  GATE_10_CONSTANTS,
  BREACH_PENALTY_PCT,
} from '@/seed/types/edge-gpu-mesh';

/**
 * Determines SLA breach tier and tiered penalty percentage.
 *
 * Tiers:
 * - None: downtime <= 2.592s -> 0.0% penalty
 * - Minor: 2.592s < downtime <= 25.92s (5-nines tier) -> 15.0% penalty
 * - Moderate: 25.92s < downtime <= 259.2s (4-nines tier) -> 35.0% penalty
 * - Major: 259.2s < downtime <= 2,592s (3-nines tier) -> 70.0% penalty
 * - Catastrophic: downtime > 2,592s (> 43.2 min) -> 100.0% penalty
 */
export function determineSixNinesBreachTier(
  downtimeSeconds: number,
  allowedDowntimeSeconds: number = GATE_10_CONSTANTS.SIX_NINES_ALLOWED_DOWNTIME_SECONDS,
): { breachTier: SixNinesBreachTier; penaltyPct: number } {
  const roundedDowntime = Math.round(downtimeSeconds * 1000) / 1000;
  const roundedAllowed = Math.round(allowedDowntimeSeconds * 1000) / 1000;

  if (roundedDowntime <= roundedAllowed) {
    return { breachTier: 'none', penaltyPct: BREACH_PENALTY_PCT.none };
  }

  // Minor breach: > 2.592s and <= 25.92s
  if (roundedDowntime <= roundedAllowed * 10) {
    return { breachTier: 'minor', penaltyPct: BREACH_PENALTY_PCT.minor };
  }

  // Moderate breach: > 25.92s and <= 259.2s
  if (roundedDowntime <= roundedAllowed * 100) {
    return { breachTier: 'moderate', penaltyPct: BREACH_PENALTY_PCT.moderate };
  }

  // Major breach: > 259.2s and <= 2,592s
  if (roundedDowntime <= roundedAllowed * 1000) {
    return { breachTier: 'major', penaltyPct: BREACH_PENALTY_PCT.major };
  }

  // Catastrophic breach: > 2,592s
  return { breachTier: 'catastrophic', penaltyPct: BREACH_PENALTY_PCT.catastrophic };
}

/**
 * Calculates Six-Nines (99.9999%) uptime metrics with millisecond/microsecond precision.
 *
 * In a standard 30-day month (2,592,000s):
 * Allowed Downtime = 2,592,000 * (1 - 0.999999) = 2.592 seconds.
 */
export function calculateSixNinesUptimeMetrics(
  downtimeSeconds: number,
  totalPeriodSeconds: number = GATE_10_CONSTANTS.MONTHLY_PERIOD_SECONDS,
): SixNinesSlaMetrics {
  const sanitizedDowntime = Math.max(0, Math.round(downtimeSeconds * 1000) / 1000);
  const totalSeconds = Math.max(1, totalPeriodSeconds);

  // Exact Six-Nines allowed error budget: 2.592s for 2,592,000s
  const errorBudgetAllocatedSeconds = Number(
    ((1 - GATE_10_CONSTANTS.SIX_NINES_SLA_PCT / 100) * totalSeconds).toFixed(4),
  );

  const uptimeSeconds = Math.max(0, totalSeconds - sanitizedDowntime);
  const actualUptimePct = Number(((uptimeSeconds / totalSeconds) * 100).toFixed(6));

  const errorBudgetConsumedSeconds = sanitizedDowntime;
  const errorBudgetRemainingSeconds = Number(
    Math.max(0, errorBudgetAllocatedSeconds - sanitizedDowntime).toFixed(4),
  );

  const errorBudgetBurnRatePct =
    errorBudgetAllocatedSeconds > 0
      ? Number(((sanitizedDowntime / errorBudgetAllocatedSeconds) * 100).toFixed(2))
      : 0.0;

  const { breachTier, penaltyPct } = determineSixNinesBreachTier(
    sanitizedDowntime,
    errorBudgetAllocatedSeconds,
  );

  return {
    targetSlaPct: GATE_10_CONSTANTS.SIX_NINES_SLA_PCT,
    actualUptimePct,
    totalPeriodSeconds: totalSeconds,
    allowedDowntimeSeconds: errorBudgetAllocatedSeconds,
    downtimeSeconds: sanitizedDowntime,
    errorBudgetAllocatedSeconds,
    errorBudgetConsumedSeconds,
    errorBudgetRemainingSeconds,
    errorBudgetBurnRatePct,
    breachTier,
    penaltyPct,
  };
}
