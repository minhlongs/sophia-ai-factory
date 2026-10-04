/**
 * @file quingentiquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Quingenti-Quadrillion Sub-Planck Power & Eighty-One-Nines (81 Nines) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  EIGHTY_ONE_NINES_SLA_CONSTANTS,
  type QuingentiquadrillionEmpirePowerSource,
} from '@/seed/types/quingentiquadrillion-sub-planck-mesh-nexus';

export type EightyOneNinesSlaVerdict =
  | 'EIGHTY_ONE_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface QuingentiquadrillionSubPlanckPowerInput {
  powerSourceType: QuingentiquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface QuingentiquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface EightyOneNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  quingentiquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface EightyOneNinesSlaEvaluationOutput {
  slaVerdict: EightyOneNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Quingenti-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 800.0).
 */
export function validateQuingentiquadrillionSubPlanckPower(
  input: QuingentiquadrillionSubPlanckPowerInput
): QuingentiquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: QuingentiquadrillionEmpirePowerSource[] = [
    'QUINGENTIQUADRILLION_ZERO_POINT_HARVESTER',
    'QUINGENTIQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid quingentiquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < EIGHTY_ONE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${EIGHTY_ONE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Quingenti-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `QUINGENTIQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Eighty-One-Nines (81 Nines) SLA uptime across the Quingenti-Quadrillion Singularity Mesh.
 */
export function evaluateEightyOneNinesSla(
  input: EightyOneNinesSlaInput
): EightyOneNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? EIGHTY_ONE_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    EIGHTY_ONE_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Eighty-One-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.quingentiquadrillionFoamSingularityActive) {
    violations.push(
      'Quingenti-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.99999999999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.99999999999999999999% threshold`
    );
  }

  const slaVerdict: EightyOneNinesSlaVerdict =
    violations.length === 0 ? 'EIGHTY_ONE_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `EIGHTY_ONE_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
