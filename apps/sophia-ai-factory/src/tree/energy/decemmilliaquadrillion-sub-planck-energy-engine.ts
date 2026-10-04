/**
 * @file decemmilliaquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Decem-Millia-Quadrillion (10.0 Quintillion) Sub-Planck Power & Ninety-Three-Nines (93 Nines) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
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
  const violations: string[] = [];

  const validSources: DecemmilliaquadrillionEmpirePowerSource[] = [
    'DECEMMILLIAQUADRILLION_ZERO_POINT_HARVESTER',
    'DECEMMILLIAQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid decemmilliaquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < NINETY_THREE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${NINETY_THREE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Decem-Millia-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `DECEMMILLIAQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Ninety-Three-Nines (93 Nines) SLA uptime across the Decem-Millia-Quadrillion Singularity Mesh.
 */
export function evaluateNinetyThreeNinesSla(
  input: NinetyThreeNinesSlaInput
): NinetyThreeNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? NINETY_THREE_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    NINETY_THREE_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Ninety-Three-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.decemmilliaquadrillionFoamSingularityActive) {
    violations.push(
      'Decem-Millia-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.999999999999999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.999999999999999999999999% threshold`
    );
  }

  const slaVerdict: NinetyThreeNinesSlaVerdict =
    violations.length === 0 ? 'NINETY_THREE_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `NINETY_THREE_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
