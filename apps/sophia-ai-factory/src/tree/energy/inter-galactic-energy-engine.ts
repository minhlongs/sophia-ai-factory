/**
 * @file inter-galactic-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Omni-Cosmic Power & Thirty-Six-Nines (99.9999999999999999999999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  validateParameterizedPower,
  evaluateParameterizedMultiNinesSla,
} from './net-zero-sla-domain-engine';

import { THIRTY_SIX_NINES_SLA_CONSTANTS } from '@/seed/types/inter-galactic-quantum-mesh-nexus';

export type ThirtySixNinesSlaVerdict =
  | 'THIRTY_SIX_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface InterGalacticPowerInput {
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  cryoPowerMw: number;
  boseEinsteinCop: number;
}

export interface InterGalacticPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface ThirtySixNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  interGalacticZeroPointEntanglementActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface ThirtySixNinesSlaEvaluationOutput {
  slaVerdict: ThirtySixNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Inter-Galactic harvest power allocation and extreme Bose-Einstein Condensate cooling metrics.
 */
export function validateInterGalacticPower(
  input: InterGalacticPowerInput
): InterGalacticPowerValidationOutput {
  const result = validateParameterizedPower(
    input,
    {
      minCop: THIRTY_SIX_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP,
      positivePowerMessage: 'Allocated megawatts must be strictly positive',
    },
    {
      powerHashFn: (ctx) =>
        createHash('sha256')
          .update(`INTER_GALACTIC_POWER_AUDIT:${ctx.isCompliant}:${ctx.allocatedMegawatts}:${ctx.carbonIntensity}:${ctx.cop}`)
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
 * Evaluates continuous Thirty-Six-Nines (99.9999999999999999999999999999999999%) SLA uptime across the Inter-Galactic Continuum.
 */
export function evaluateThirtySixNinesSla(
  input: ThirtySixNinesSlaInput
): ThirtySixNinesSlaEvaluationOutput {
  const maxAllowed = THIRTY_SIX_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;
  const result = evaluateParameterizedMultiNinesSla(
    input,
    {
      maxAllowedDowntime: maxAllowed,
      totalWindow: input.totalWindowNanoseconds ?? THIRTY_SIX_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS,
      certifiedVerdict: 'THIRTY_SIX_NINES_CERTIFIED',
      breachVerdict: 'BREACH_LIQUIDITY_PENALIZED',
      precision: 18,
      downtimeViolationFormatter: (actual, max) => `Downtime ${actual} ns exceeds allowable Thirty-Six-Nines budget of ${max} ns`,
      entanglementActiveGetter: (inp: Record<string, unknown>) => Boolean(inp.interGalacticZeroPointEntanglementActive),
      entanglementViolationMessage: 'Inter-Galactic zero-point quantum entanglement mesh link is degraded or inactive',
      minBftQuorumPct: 99.99999,
      minBftViolationFormatter: (actual, _min) => `BFT quorum consensus ${actual}% is below required 99.99999% threshold`,
    },
    {
      auditSignatureFn: (ctx) =>
        createHash('sha256')
          .update(`THIRTY_SIX_NINES_SLA:${ctx.slaVerdict}:${ctx.actualDowntime}:${ctx.effectiveAvailabilityPct}:${ctx.bftQuorumPct}`)
          .digest('hex'),
    }
  );

  return {
    slaVerdict: result.slaVerdict as unknown as ThirtySixNinesSlaVerdict,
    effectiveAvailabilityPct: result.effectiveAvailabilityPct,
    maxAllowedDowntimeNanoseconds: maxAllowed,
    actualDowntimeNanoseconds: input.actualDowntimeNanoseconds,
    violations: result.violations,
    auditSignature: result.auditSignature,
  };
}
