/**
 * @file matrioshka-power-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Matrioshka Clean Energy & Ten-Nines (99.99999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  validateParameterizedPower,
  evaluateParameterizedMultiNinesSla,
} from './net-zero-sla-domain-engine';
import {
  TEN_NINES_SLA_CONSTANTS,
  type SlaVerdict,
} from '@/seed/types/ronanflop-matrix';

export interface MatrioshkaPowerInput {
  allocatedMegawatts: number;
  carbonIntensityGCo2PerKwh: number;
  cryoCoolingPowerMw: number;
  coolingEfficiencyCop: number;
}

export interface MatrioshkaPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface TenNinesSlaInput {
  totalWindowMicroseconds?: number;
  actualDowntimeMicroseconds: number;
  quantumTeleportSyncActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface TenNinesSlaEvaluationOutput {
  slaVerdict: SlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeMicroseconds: number;
  actualDowntimeMicroseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Matrioshka Brain clean power allocation and cryo-photonic cooling metrics.
 */
export function validateMatrioshkaPower(input: MatrioshkaPowerInput): MatrioshkaPowerValidationOutput {
  const result = validateParameterizedPower(
    input,
    {
      minCop: TEN_NINES_SLA_CONSTANTS.MIN_CRYO_COP,
      positivePowerMessage: 'Allocated power must be strictly positive',
      positiveCryoPowerMessage: 'Cryo cooling power allocation must be strictly positive',
    },
    {
      powerHashFn: (ctx) =>
        createHash('sha256')
          .update(`MATRIOSHKA_POWER:${ctx.allocatedMegawatts}:${ctx.carbonIntensity}:${ctx.cop}:${ctx.isCompliant}`)
          .digest('hex'),
    }
  );

  return {
    isCompliant: result.isCompliant,
    violations: result.violations,
    verificationHash: result.verificationHash,
  };
}

/**
 * Evaluates Ten-Nines (99.99999999%) SLA uptime at microsecond resolution.
 */
export function evaluateTenNinesSla(input: TenNinesSlaInput): TenNinesSlaEvaluationOutput {
  const maxAllowed = TEN_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_MICROSECONDS;
  const result = evaluateParameterizedMultiNinesSla(
    input,
    {
      maxAllowedDowntime: maxAllowed,
      totalWindow: input.totalWindowMicroseconds ?? TEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_MICROSECONDS,
      certifiedVerdict: 'TEN_NINES_CERTIFIED',
      breachVerdict: 'BREACH_LIQUIDITY_PENALIZED',
      precision: 8,
      downtimeViolationFormatter: (actual, max) =>
        `Actual downtime ${actual} µs exceeds maximum allowable Ten-Nines downtime ${max} µs (0.2592 ms)`,
      entanglementActiveGetter: (inp: Record<string, unknown>) => Boolean(inp.quantumTeleportSyncActive),
      entanglementViolationMessage: 'Quantum teleportation state synchronization is inactive',
      minBftQuorumPct: 100.0,
      minBftViolationFormatter: (actual, _min) =>
        `Byzantine Fault Tolerant quorum consensus ${actual}% is below 100.0% requirement`,
    },
    {
      auditSignatureFn: (ctx) =>
        createHash('sha256')
          .update(`TEN_NINES_AUDIT:${ctx.slaVerdict}:${ctx.actualDowntime}:${ctx.effectiveAvailabilityPct}:${auditTimestampIso()}`)
          .digest('hex'),
    }
  );

  return {
    slaVerdict: result.slaVerdict as SlaVerdict,
    effectiveAvailabilityPct: result.effectiveAvailabilityPct,
    maxAllowedDowntimeMicroseconds: maxAllowed,
    actualDowntimeMicroseconds: input.actualDowntimeMicroseconds,
    violations: result.violations,
    auditSignature: result.auditSignature,
  };
}

function auditTimestampIso(): string {
  return '2026-09-27T00:00:00Z';
}
