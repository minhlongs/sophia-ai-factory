/**
 * @file matrioshka-brain-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Matrioshka Brain Net-Zero Power & Thirteen-Nines (99.99999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  validateParameterizedPower,
  evaluateParameterizedMultiNinesSla,
} from './net-zero-sla-domain-engine';
import { THIRTEEN_NINES_SLA_CONSTANTS } from '@/seed/types/quantum-superconducting-nexus';

export type ThirteenNinesSlaVerdict =
  | 'THIRTEEN_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface MatrioshkaPowerInput {
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  cryoPowerMw: number;
  heliumCryoCop: number;
}

export interface MatrioshkaPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface ThirteenNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  quantumEntanglementActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface ThirteenNinesSlaEvaluationOutput {
  slaVerdict: ThirteenNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Matrioshka Brain stellar power allocation and extreme helium cryo cooling metrics.
 */
export function validateMatrioshkaPower(
  input: MatrioshkaPowerInput
): MatrioshkaPowerValidationOutput {
  const result = validateParameterizedPower(
    input,
    {
      minCop: THIRTEEN_NINES_SLA_CONSTANTS.MIN_HELIUM_CRYO_COP,
      positivePowerMessage: 'Allocated power must be strictly positive',
      positiveCryoPowerMessage: 'Cryo cooling power allocation must be strictly positive',
    },
    {
      powerHashFn: (ctx) =>
        createHash('sha256')
          .update(
            `MATRIOSHKA_POWER:${ctx.allocatedMegawatts}:${ctx.carbonIntensity}:${ctx.cop}:${ctx.isCompliant}`
          )
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
 * Evaluates Thirteen-Nines (99.99999999999%) SLA uptime at sub-microsecond/nanosecond resolution.
 */
export function evaluateThirteenNinesSla(
  input: ThirteenNinesSlaInput
): ThirteenNinesSlaEvaluationOutput {
  const maxAllowed = THIRTEEN_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;
  const result = evaluateParameterizedMultiNinesSla(
    input,
    {
      maxAllowedDowntime: maxAllowed,
      totalWindow: input.totalWindowNanoseconds ?? THIRTEEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS,
      certifiedVerdict: 'THIRTEEN_NINES_CERTIFIED',
      breachVerdict: 'BREACH_LIQUIDITY_PENALIZED',
      precision: 11,
      downtimeViolationFormatter: (actual, max) =>
        `Actual downtime ${actual} ns exceeds maximum allowable Thirteen-Nines downtime ${max} ns (0.2592 µs)`,
      entanglementActiveGetter: (inp: Record<string, unknown>) => Boolean(inp.quantumEntanglementActive),
      entanglementViolationMessage: 'Quantum entangled state redundancy synchronization is inactive',
      minBftQuorumPct: 100.0,
      minBftViolationFormatter: (actual, _min) =>
        `Byzantine Fault Tolerant quorum consensus ${actual}% is below 100.0% requirement`,
    },
    {
      auditSignatureFn: (ctx) =>
        createHash('sha256')
          .update(
            `THIRTEEN_NINES_AUDIT:${ctx.slaVerdict}:${ctx.actualDowntime}:${ctx.effectiveAvailabilityPct}:${ctx.timestampIso}`
          )
          .digest('hex'),
    }
  );

  return {
    slaVerdict: result.slaVerdict as ThirteenNinesSlaVerdict,
    effectiveAvailabilityPct: result.effectiveAvailabilityPct,
    maxAllowedDowntimeNanoseconds: maxAllowed,
    actualDowntimeNanoseconds: input.actualDowntimeNanoseconds,
    violations: result.violations,
    auditSignature: result.auditSignature,
  };
}
