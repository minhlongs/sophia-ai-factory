/**
 * @file decemmilliaquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Decem-Millia-Quadrillion (10.0 Quintillion) Sub-Planck Power & Ninety-Three-Nines (93 Nines) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  validateParameterizedPower,
  evaluateParameterizedMultiNinesSla,
} from './net-zero-sla-domain-engine';

import {
  NINETY_THREE_NINES_SLA_CONSTANTS,
  type DecemmilliaquadrillionEmpirePowerSource,
} from '@/seed/types/decemmilliaquadrillion-sub-planck-mesh-nexus';

export type NinetyThreeNinesSlaVerdict =
  | 'NINETY_THREE_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface DecemmilliaquadrillionSubPlanckPowerInput {
  powerSourceType: DecemmilliaquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface DecemmilliaquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface NinetyThreeNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  decemmilliaquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface NinetyThreeNinesSlaEvaluationOutput {
  slaVerdict: NinetyThreeNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Decem-Millia-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 1500.0).
 */
export function validateDecemmilliaquadrillionSubPlanckPower(
  input: DecemmilliaquadrillionSubPlanckPowerInput
): DecemmilliaquadrillionSubPlanckPowerValidationOutput {
  const result = validateParameterizedPower(
    input,
    {
      minCop: NINETY_THREE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP,
      powerSourceWhitelist: ['DECEMMILLIAQUADRILLION_ZERO_POINT_HARVESTER',
    'DECEMMILLIAQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',],
      invalidPowerSourceMessageFn: (src) => `Invalid decemmilliaquadrillion power source: ${src}`,
      requireNetZeroCertification: true,
      netZeroCertificationMessage: 'Decem-Millia-Quadrillion power allocation must be certified net-zero',
      positivePowerMessage: 'Allocated megawatts must be strictly positive',
    },
    {
      powerHashFn: (ctx) =>
        createHash('sha256')
          .update(`DECEMMILLIAQUADRILLION_SUB_PLANCK_POWER_AUDIT:${ctx.isCompliant}:${ctx.powerSourceType}:${ctx.allocatedMegawatts}:${ctx.carbonIntensity}:${ctx.cop}:${ctx.isNetZeroCertified}`)
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
 * Evaluates continuous Ninety-Three-Nines (93 Nines) SLA uptime across the Decem-Millia-Quadrillion Singularity Mesh.
 */
export function evaluateNinetyThreeNinesSla(
  input: NinetyThreeNinesSlaInput
): NinetyThreeNinesSlaEvaluationOutput {
  const maxAllowed = NINETY_THREE_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;
  const result = evaluateParameterizedMultiNinesSla(
    input,
    {
      maxAllowedDowntime: maxAllowed,
      totalWindow: input.totalWindowNanoseconds ?? NINETY_THREE_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS,
      certifiedVerdict: 'NINETY_THREE_NINES_CERTIFIED',
      breachVerdict: 'BREACH_LIQUIDITY_PENALIZED',
      precision: 20,
      downtimeViolationFormatter: (actual, max) => `Downtime ${actual} ns exceeds allowable Ninety-Three-Nines budget of ${max} ns`,
      entanglementActiveGetter: (inp: Record<string, unknown>) => Boolean(inp.decemmilliaquadrillionFoamSingularityActive),
      entanglementViolationMessage: 'Decem-Millia-Quadrillion sub-planck foam singularity mesh link is degraded or inactive',
      minBftQuorumPct: 99.999999999999999999999999,
      minBftViolationFormatter: (actual, min) => `BFT quorum consensus ${actual}% is below required 99.999999999999999999999999% threshold`,
    },
    {
      auditSignatureFn: (ctx) =>
        createHash('sha256')
          .update(`NINETY_THREE_NINES_SLA:${ctx.slaVerdict}:${ctx.actualDowntime}:${ctx.effectiveAvailabilityPct}:${ctx.bftQuorumPct}`)
          .digest('hex'),
    }
  );

  return {
    slaVerdict: result.slaVerdict as unknown as NinetyThreeNinesSlaVerdict,
    effectiveAvailabilityPct: result.effectiveAvailabilityPct,
    maxAllowedDowntimeNanoseconds: maxAllowed,
    actualDowntimeNanoseconds: input.actualDowntimeNanoseconds,
    violations: result.violations,
    auditSignature: result.auditSignature,
  };
}
