/**
 * @file zero-point-flux-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Zero-Point Vacuum Flux Power & Fifteen-Nines (99.9999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  validateParameterizedPower,
  evaluateParameterizedMultiNinesSla,
} from './net-zero-sla-domain-engine';
import { FIFTEEN_NINES_SLA_CONSTANTS } from '@/seed/types/femtosecond-vacuum-nexus';

export type FifteenNinesSlaVerdict =
  | 'FIFTEEN_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface ZeroPointFluxPowerInput {
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  cryoPowerMw: number;
  boseEinsteinCop: number;
}

export interface ZeroPointFluxPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface FifteenNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  anyonicEntanglementActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface FifteenNinesSlaEvaluationOutput {
  slaVerdict: FifteenNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Zero-Point Vacuum Flux power allocation and extreme Bose-Einstein cryo cooling metrics.
 */
export function validateZeroPointFluxPower(
  input: ZeroPointFluxPowerInput
): ZeroPointFluxPowerValidationOutput {
  const result = validateParameterizedPower(
    input,
    {
      minCop: FIFTEEN_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP,
      positivePowerMessage: 'Allocated power must be strictly positive',
      positiveCryoPowerMessage: 'Cryo cooling power allocation must be strictly positive',
    },
    {
      powerHashFn: (ctx) =>
        createHash('sha256')
          .update(
            `ZERO_POINT_FLUX_POWER:${ctx.allocatedMegawatts}:${ctx.carbonIntensity}:${ctx.cop}:${ctx.isCompliant}`
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
 * Evaluates Fifteen-Nines (99.9999999999999%) SLA uptime at sub-nanosecond resolution.
 */
export function evaluateFifteenNinesSla(
  input: FifteenNinesSlaInput
): FifteenNinesSlaEvaluationOutput {
  const maxAllowed = FIFTEEN_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;
  const result = evaluateParameterizedMultiNinesSla(
    input,
    {
      maxAllowedDowntime: maxAllowed,
      totalWindow: input.totalWindowNanoseconds ?? FIFTEEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS,
      certifiedVerdict: 'FIFTEEN_NINES_CERTIFIED',
      breachVerdict: 'BREACH_LIQUIDITY_PENALIZED',
      precision: 13,
      downtimeViolationFormatter: (actual, max) =>
        `Actual downtime ${actual} ns exceeds maximum allowable Fifteen-Nines downtime ${max} ns (0.002592 µs)`,
      entanglementActiveGetter: (inp: Record<string, unknown>) => Boolean(inp.anyonicEntanglementActive),
      entanglementViolationMessage: 'Anyonic topological entangled state redundancy synchronization is inactive',
      minBftQuorumPct: 100.0,
      minBftViolationFormatter: (actual, _min) =>
        `Byzantine Fault Tolerant quorum consensus ${actual}% is below 100.0% requirement`,
    },
    {
      auditSignatureFn: (ctx) =>
        createHash('sha256')
          .update(
            `FIFTEEN_NINES_AUDIT:${ctx.slaVerdict}:${ctx.actualDowntime}:${ctx.effectiveAvailabilityPct}:${ctx.timestampIso}`
          )
          .digest('hex'),
    }
  );

  return {
    slaVerdict: result.slaVerdict as FifteenNinesSlaVerdict,
    effectiveAvailabilityPct: result.effectiveAvailabilityPct,
    maxAllowedDowntimeNanoseconds: maxAllowed,
    actualDowntimeNanoseconds: input.actualDowntimeNanoseconds,
    violations: result.violations,
    auditSignature: result.auditSignature,
  };
}
