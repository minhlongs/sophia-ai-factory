/**
 * Extreme Multi-Nines SLA Violation Checkers & Cryptographic Audit Signature
 *
 * @module tree/energy/sla/sla-violation-checks
 */

import { createHash } from 'node:crypto';
import type {
  MultiNinesSlaConfig,
  MultiNinesSlaThresholds,
  SlaAuditContext,
} from './types';

export function checkDowntimeViolation(
  actualDowntime: number,
  maxAllowed: number,
  thresholds: MultiNinesSlaThresholds,
  violations: string[]
): void {
  if (actualDowntime > maxAllowed) {
    if (thresholds.downtimeViolationFormatter) {
      violations.push(thresholds.downtimeViolationFormatter(actualDowntime, maxAllowed));
    } else if (thresholds.slaName) {
      const unit = thresholds.timeUnit ?? 'ns';
      violations.push(
        `Actual downtime ${actualDowntime} ${unit} exceeds maximum allowable ${thresholds.slaName} downtime ${maxAllowed} ${unit}`
      );
    } else {
      violations.push(`Actual downtime ${actualDowntime} exceeds maximum allowable SLA downtime ${maxAllowed}`);
    }
  }
}

export function resolveEntanglementStatus(
  inp: Record<string, unknown>,
  thresholds: MultiNinesSlaThresholds
): boolean | undefined {
  if (thresholds.entanglementActiveGetter) {
    return thresholds.entanglementActiveGetter(inp);
  }
  const rawEnt =
    inp.entanglementActive ??
    inp.tachyonEntanglementActive ??
    inp.anyonicEntanglementActive ??
    inp.quantumEntanglementActive;
  if (rawEnt !== undefined) {
    return Boolean(rawEnt);
  }
  for (const k of Object.keys(inp)) {
    if (k.endsWith('EntanglementActive') || k.endsWith('SingularityActive')) {
      return Boolean(inp[k]);
    }
  }
  return undefined;
}

export function checkEntanglementAndQuorum(
  inp: Record<string, unknown>,
  thresholds: MultiNinesSlaThresholds,
  violations: string[]
): number | undefined {
  const isEntanglementActive = resolveEntanglementStatus(inp, thresholds);
  if (isEntanglementActive !== undefined && !isEntanglementActive) {
    if (thresholds.entanglementViolationMessage) {
      violations.push(thresholds.entanglementViolationMessage);
    } else if (inp.anyonicEntanglementActive !== undefined) {
      violations.push('Anyonic topological entangled state redundancy synchronization is inactive');
    } else {
      violations.push('Quantum entangled state redundancy synchronization is inactive');
    }
  }

  const minQuorum = thresholds.minBftQuorumPct ?? 100.0;
  const bftQuorumPct = typeof inp.bftQuorumConsensusPct === 'number' ? inp.bftQuorumConsensusPct : undefined;
  if (bftQuorumPct !== undefined && bftQuorumPct < minQuorum) {
    if (thresholds.minBftViolationFormatter) {
      violations.push(thresholds.minBftViolationFormatter(bftQuorumPct, minQuorum));
    } else {
      violations.push(`Byzantine Fault Tolerant quorum consensus ${bftQuorumPct}% is below ${minQuorum.toFixed(1)}% requirement`);
    }
  }
  return bftQuorumPct;
}

export function computeSlaAuditSignature(
  ctx: SlaAuditContext,
  config: MultiNinesSlaConfig
): string {
  if (config.auditSignatureFn) {
    return config.auditSignatureFn(ctx);
  }
  const prefix = config.hashPrefix ?? 'SLA_AUDIT';
  return createHash('sha256')
    .update(`${prefix}:${ctx.slaVerdict}:${ctx.actualDowntime}:${ctx.effectiveAvailabilityPct}:${ctx.timestampIso}`)
    .digest('hex');
}
