/**
 * @file decaquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Deca-Quadrillion Sub-Planck Power & Fifty-Seven-Nines (99.9999999999999999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  FIFTY_SEVEN_NINES_SLA_CONSTANTS,
  type DecaquadrillionEmpirePowerSource,
} from '@/seed/types/decaquadrillion-sub-planck-mesh-nexus';

export type FiftySevenNinesSlaVerdict =
  | 'FIFTY_SEVEN_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface DecaquadrillionSubPlanckPowerInput {
  powerSourceType: DecaquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface DecaquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface FiftySevenNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  decaquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface FiftySevenNinesSlaEvaluationOutput {
  slaVerdict: FiftySevenNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Deca-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 260.0).
 */
export function validateDecaquadrillionSubPlanckPower(
  input: DecaquadrillionSubPlanckPowerInput
): DecaquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: DecaquadrillionEmpirePowerSource[] = [
    'DECAQUADRILLION_ZERO_POINT_HARVESTER',
    'DECAQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid decaquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < FIFTY_SEVEN_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${FIFTY_SEVEN_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Deca-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `DECAQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Fifty-Seven-Nines (99.9999999999999999999999999999999999999999999999999999999%) SLA uptime across the Deca-Quadrillion Singularity Mesh.
 */
export function evaluateFiftySevenNinesSla(
  input: FiftySevenNinesSlaInput
): FiftySevenNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? FIFTY_SEVEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    FIFTY_SEVEN_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Fifty-Seven-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.decaquadrillionFoamSingularityActive) {
    violations.push(
      'Deca-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.999999999999% threshold`
    );
  }

  const slaVerdict: FiftySevenNinesSlaVerdict =
    violations.length === 0 ? 'FIFTY_SEVEN_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `FIFTY_SEVEN_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
