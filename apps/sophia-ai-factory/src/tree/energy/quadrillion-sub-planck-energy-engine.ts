/**
 * @file quadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Quadrillion Sub-Planck Power & Forty-Eight-Nines (99.9999999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  FORTY_EIGHT_NINES_SLA_CONSTANTS,
  type QuadrillionEmpirePowerSource,
} from '@/seed/types/quadrillion-sub-planck-mesh-nexus';

export type FortyEightNinesSlaVerdict =
  | 'FORTY_EIGHT_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface QuadrillionSubPlanckPowerInput {
  powerSourceType: QuadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface QuadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface FortyEightNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  quadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface FortyEightNinesSlaEvaluationOutput {
  slaVerdict: FortyEightNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 150.0).
 */
export function validateQuadrillionSubPlanckPower(
  input: QuadrillionSubPlanckPowerInput
): QuadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: QuadrillionEmpirePowerSource[] = [
    'QUADRILLION_ZERO_POINT_HARVESTER',
    'QUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid quadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < FORTY_EIGHT_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${FORTY_EIGHT_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `QUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Forty-Eight-Nines (99.9999999999999999999999999999999999999999999999%) SLA uptime across the Quadrillion Singularity Mesh.
 */
export function evaluateFortyEightNinesSla(
  input: FortyEightNinesSlaInput
): FortyEightNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? FORTY_EIGHT_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    FORTY_EIGHT_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Forty-Eight-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.quadrillionFoamSingularityActive) {
    violations.push(
      'Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.999999999% threshold`
    );
  }

  const slaVerdict: FortyEightNinesSlaVerdict =
    violations.length === 0 ? 'FORTY_EIGHT_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `FORTY_EIGHT_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
