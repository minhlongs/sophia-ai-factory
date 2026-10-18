/**
 * hectocorn-sla-evaluator.ts — Seven-Nines (99.99999%) SLA Tracker
 *
 * @module tree/compute/hectocorn-sla-evaluator
 */

import type { SevenNinesSlaEvent } from '@/seed/types/hectocorn-compute';

/**
 * Evaluates Seven-Nines (99.99999%) SLA for a given monthly period:
 * Allowed downtime: ≤ 259.2 ms in 30 days (2,592,000 seconds)
 */
export function evaluateSevenNinesSla(
  monthPeriod: string,
  downtimeMilliseconds: number,
): SevenNinesSlaEvent {
  const totalSeconds = 30 * 86400; // 2,592,000 seconds
  const totalMs = totalSeconds * 1000;
  const effectiveUptimeMs = Math.max(0, totalMs - downtimeMilliseconds);
  const uptimePercentage =
    totalMs > 0 ? (effectiveUptimeMs / totalMs) * 100 : 100;

  let breachStatus: 'HEALTHY' | 'WARNING' | 'BREACHED' = 'HEALTHY';
  let penaltiesEscrowCents = 0;

  if (downtimeMilliseconds > 259) {
    breachStatus = 'BREACHED';
    // $10,000 penalty per 100ms over 259ms
    penaltiesEscrowCents = Math.round(((downtimeMilliseconds - 259) / 100) * 1_000_000);
  } else if (downtimeMilliseconds > 200) {
    breachStatus = 'WARNING';
  }

  return {
    id: `sla_${monthPeriod.replace('-', '_')}`,
    monthPeriod,
    totalSeconds,
    downtimeMilliseconds,
    uptimePercentage: Math.min(100, Math.max(0, uptimePercentage)),
    breachStatus,
    penaltiesEscrowCents,
    lastEvaluatedAt: new Date().toISOString(),
  };
}
