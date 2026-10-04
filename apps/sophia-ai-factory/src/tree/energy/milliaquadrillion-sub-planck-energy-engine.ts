/**
 * @file milliaquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Millia-Quadrillion (Quintillion) Sub-Planck Power & Eighty-Four-Nines (84 Nines) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  EIGHTY_FOUR_NINES_SLA_CONSTANTS,
  type MilliaquadrillionEmpirePowerSource,
} from '@/seed/types/milliaquadrillion-sub-planck-mesh-nexus';

export type EightyFourNinesSlaVerdict =
  | 'EIGHTY_FOUR_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface MilliaquadrillionSubPlanckPowerInput {
  powerSourceType: MilliaquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface MilliaquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface EightyFourNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  milliaquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface EightyFourNinesSlaEvaluationOutput {
  slaVerdict: EightyFourNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Millia-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 900.0).
 */
export function validateMilliaquadrillionSubPlanckPower(
  input: MilliaquadrillionSubPlanckPowerInput
): MilliaquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: MilliaquadrillionEmpirePowerSource[] = [
    'MILLIAQUADRILLION_ZERO_POINT_HARVESTER',
    'MILLIAQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid milliaquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < EIGHTY_FOUR_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${EIGHTY_FOUR_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Millia-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `MILLIAQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Eighty-Four-Nines (84 Nines) SLA uptime across the Millia-Quadrillion Singularity Mesh.
 */
export function evaluateEightyFourNinesSla(
  input: EightyFourNinesSlaInput
): EightyFourNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? EIGHTY_FOUR_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    EIGHTY_FOUR_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Eighty-Four-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.milliaquadrillionFoamSingularityActive) {
    violations.push(
      'Millia-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.999999999999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.999999999999999999999% threshold`
    );
  }

  const slaVerdict: EightyFourNinesSlaVerdict =
    violations.length === 0 ? 'EIGHTY_FOUR_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `EIGHTY_FOUR_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
