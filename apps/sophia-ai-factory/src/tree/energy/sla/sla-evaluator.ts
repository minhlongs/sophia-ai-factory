/**
 * Extreme Multi-Nines SLA Availability Evaluator and Cryptographic Signature
 *
 * @module tree/energy/sla/sla-evaluator
 */

import type {
  MultiNinesSlaConfig,
  MultiNinesSlaResult,
  MultiNinesSlaThresholds,
  SlaAuditContext,
} from './types';
import {
  checkDowntimeViolation,
  resolveEntanglementStatus,
  checkEntanglementAndQuorum,
  computeSlaAuditSignature,
} from './sla-violation-checks';

export {
  checkDowntimeViolation,
  resolveEntanglementStatus,
  checkEntanglementAndQuorum,
  computeSlaAuditSignature,
};

/**
 * Parameterized evaluator for extreme multi-nines availability SLA.
 */
export function evaluateParameterizedMultiNinesSla<T = unknown>(
  input: T,
  thresholds: MultiNinesSlaThresholds,
  config: MultiNinesSlaConfig = {}
): MultiNinesSlaResult {
  const inp = input as Record<string, unknown>;
  const actualDowntime = Number(
    inp.actualDowntime ??
    inp.actualDowntimeNanoseconds ??
    inp.actualDowntimeMicroseconds ??
    inp.actualDowntimeAttoseconds ??
    inp.actualDowntimeZeptoseconds ??
    0
  );

  const maxAllowed = thresholds.maxAllowedDowntime;
  const totalWindow = Number(
    inp.totalWindow ??
    inp.totalWindowNanoseconds ??
    inp.totalWindowMicroseconds ??
    thresholds.totalWindow ??
    2_592_000_000_000_000 // default 30 days in ns
  );

  const violations: string[] = [];
  checkDowntimeViolation(actualDowntime, maxAllowed, thresholds, violations);
  const bftQuorumPct = checkEntanglementAndQuorum(inp, thresholds, violations);

  const precision = thresholds.precision ?? 10;
  const effectiveAvailabilityPct =
    totalWindow > 0
      ? Number((((totalWindow - actualDowntime) / totalWindow) * 100).toFixed(precision))
      : 0.0;

  const isCertified = violations.length === 0;
  const slaVerdict = isCertified
    ? thresholds.certifiedVerdict
    : (thresholds.breachVerdict ?? 'BREACH_LIQUIDITY_PENALIZED');

  const timestamp = config.timestampIso ?? '2026-09-28T00:00:00Z';

  const ctx: SlaAuditContext = {
    slaVerdict,
    actualDowntime,
    effectiveAvailabilityPct,
    maxAllowedDowntime: maxAllowed,
    bftQuorumPct,
    timestampIso: timestamp,
  };

  const auditSignature = computeSlaAuditSignature(ctx, config);

  return {
    slaVerdict,
    effectiveAvailabilityPct,
    maxAllowedDowntimeNanoseconds: maxAllowed,
    maxAllowedDowntimeMicroseconds: maxAllowed,
    actualDowntimeNanoseconds: actualDowntime,
    actualDowntimeMicroseconds: actualDowntime,
    actualDowntimeAttoseconds: actualDowntime,
    violations,
    auditSignature,
  };
}
