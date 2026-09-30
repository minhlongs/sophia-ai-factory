/**
 * @file biquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Bi-Quadrillion Sub-Planck Power & Fifty-One-Nines (99.999999999999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  FIFTY_ONE_NINES_SLA_CONSTANTS,
  type BiquadrillionEmpirePowerSource,
} from '@/seed/types/biquadrillion-sub-planck-mesh-nexus';

export type FiftyOneNinesSlaVerdict =
  | 'FIFTY_ONE_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface BiquadrillionSubPlanckPowerInput {
  powerSourceType: BiquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface BiquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface FiftyOneNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  biquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface FiftyOneNinesSlaEvaluationOutput {
  slaVerdict: FiftyOneNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Bi-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 180.0).
 */
export function validateBiquadrillionSubPlanckPower(
  input: BiquadrillionSubPlanckPowerInput
): BiquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: BiquadrillionEmpirePowerSource[] = [
    'BIQUADRILLION_ZERO_POINT_HARVESTER',
    'BIQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid biquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < FIFTY_ONE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${FIFTY_ONE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Bi-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `BIQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Fifty-One-Nines (99.999999999999999999999999999999999999999999999999999%) SLA uptime across the Bi-Quadrillion Singularity Mesh.
 */
export function evaluateFiftyOneNinesSla(
  input: FiftyOneNinesSlaInput
): FiftyOneNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? FIFTY_ONE_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    FIFTY_ONE_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Fifty-One-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.biquadrillionFoamSingularityActive) {
    violations.push(
      'Bi-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.9999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.9999999999% threshold`
    );
  }

  const slaVerdict: FiftyOneNinesSlaVerdict =
    violations.length === 0 ? 'FIFTY_ONE_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

  const effectiveAvailabilityPct =
    totalWindowNanoseconds > 0
      ? Number(
          (
            ((totalWindowNanoseconds - input.actualDowntimeNanoseconds) / totalWindowNanoseconds) *
            100
          ).toFixed(18)
        )
      : 100.0;

  const auditSignature = createHash('sha256')
    .update(
      `FIFTY_ONE_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
