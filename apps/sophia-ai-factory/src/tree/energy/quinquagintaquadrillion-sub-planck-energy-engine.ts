/**
 * @file quinquagintaquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Quinquaginta-Quadrillion Sub-Planck Power & Seventy-Two-Nines (99.999999999999999999999999999999999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  SEVENTY_TWO_NINES_SLA_CONSTANTS,
  type QuinquagintaquadrillionEmpirePowerSource,
} from '@/seed/types/quinquagintaquadrillion-sub-planck-mesh-nexus';

export type SeventyTwoNinesSlaVerdict =
  | 'SEVENTY_TWO_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface QuinquagintaquadrillionSubPlanckPowerInput {
  powerSourceType: QuinquagintaquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface QuinquagintaquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface SeventyTwoNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  quinquagintaquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface SeventyTwoNinesSlaEvaluationOutput {
  slaVerdict: SeventyTwoNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Quinquaginta-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 500.0).
 */
export function validateQuinquagintaquadrillionSubPlanckPower(
  input: QuinquagintaquadrillionSubPlanckPowerInput
): QuinquagintaquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: QuinquagintaquadrillionEmpirePowerSource[] = [
    'QUINQUAGINTAQUADRILLION_ZERO_POINT_HARVESTER',
    'QUINQUAGINTAQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid quinquagintaquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < SEVENTY_TWO_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${SEVENTY_TWO_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Quinquaginta-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `QUINQUAGINTAQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Seventy-Two-Nines (99.999999999999999999999999999999999999999999999999999999999999999999999999%) SLA uptime across the Quinquaginta-Quadrillion Singularity Mesh.
 */
export function evaluateSeventyTwoNinesSla(
  input: SeventyTwoNinesSlaInput
): SeventyTwoNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? SEVENTY_TWO_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    SEVENTY_TWO_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Seventy-Two-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.quinquagintaquadrillionFoamSingularityActive) {
    violations.push(
      'Quinquaginta-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.99999999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.99999999999999999% threshold`
    );
  }

  const slaVerdict: SeventyTwoNinesSlaVerdict =
    violations.length === 0 ? 'SEVENTY_TWO_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

  const effectiveAvailabilityPct =
    totalWindowNanoseconds > 0
      ? Number(
          (
            ((totalWindowNanoseconds - input.actualDowntimeNanoseconds) / totalWindowNanoseconds) *
            100
          ).toFixed(20)
        )
      : 100.0;

  const auditSignature = createHash('sha256')
    .update(
      `SEVENTY_TWO_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
    )
    .digest('hex');

  return {
    slaVerdict,
    effectiveAvailabilityPct,
    maxAllowedDowntimeNanoseconds,
    actualDowntimeNanoseconds: input.actualDowntimeNanoseconds,
    violations,
    auditSignature,
  };
}
