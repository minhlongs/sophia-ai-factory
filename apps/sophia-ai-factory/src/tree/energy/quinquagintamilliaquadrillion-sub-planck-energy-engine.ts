/**
 * @file quinquagintamilliaquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Quinquaginta-Millia-Quadrillion (50.0 Quintillion) Sub-Planck Power & Ninety-Nine-Nines (99 Nines) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  NINETY_NINE_NINES_SLA_CONSTANTS,
  type QuinquagintamilliaquadrillionEmpirePowerSource,
} from '@/seed/types/quinquagintamilliaquadrillion-sub-planck-mesh-nexus';

export type NinetyNineNinesSlaVerdict =
  | 'NINETY_NINE_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface QuinquagintamilliaquadrillionSubPlanckPowerInput {
  powerSourceType: QuinquagintamilliaquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface QuinquagintamilliaquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface NinetyNineNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  quinquagintamilliaquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface NinetyNineNinesSlaEvaluationOutput {
  slaVerdict: NinetyNineNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Quinquaginta-Millia-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 2500.0).
 */
export function validateQuinquagintamilliaquadrillionSubPlanckPower(
  input: QuinquagintamilliaquadrillionSubPlanckPowerInput
): QuinquagintamilliaquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: QuinquagintamilliaquadrillionEmpirePowerSource[] = [
    'QUINQUAGINTAMILLIAQUADRILLION_ZERO_POINT_HARVESTER',
    'QUINQUAGINTAMILLIAQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid quinquagintamilliaquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < NINETY_NINE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${NINETY_NINE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Quinquaginta-Millia-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `QUINQUAGINTAMILLIAQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Ninety-Nine-Nines (99 Nines) SLA uptime across the Quinquaginta-Millia-Quadrillion Singularity Mesh.
 */
export function evaluateNinetyNineNinesSla(
  input: NinetyNineNinesSlaInput
): NinetyNineNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? NINETY_NINE_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    NINETY_NINE_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Ninety-Nine-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.quinquagintamilliaquadrillionFoamSingularityActive) {
    violations.push(
      'Quinquaginta-Millia-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.9999999999999999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.9999999999999999999999999% threshold`
    );
  }

  const slaVerdict: NinetyNineNinesSlaVerdict =
    violations.length === 0 ? 'NINETY_NINE_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `NINETY_NINE_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
