/**
 * @file quingentimilliaquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Quingenti-Millia-Quadrillion (5.0 Quintillion) Sub-Planck Power & Ninety-Nines (90 Nines) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  NINETY_NINES_SLA_CONSTANTS,
  type QuingentimilliaquadrillionEmpirePowerSource,
} from '@/seed/types/quingentimilliaquadrillion-sub-planck-mesh-nexus';

export type NinetyNinesSlaVerdict =
  | 'NINETY_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface QuingentimilliaquadrillionSubPlanckPowerInput {
  powerSourceType: QuingentimilliaquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface QuingentimilliaquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface NinetyNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  quingentimilliaquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface NinetyNinesSlaEvaluationOutput {
  slaVerdict: NinetyNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Quingenti-Millia-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 1200.0).
 */
export function validateQuingentimilliaquadrillionSubPlanckPower(
  input: QuingentimilliaquadrillionSubPlanckPowerInput
): QuingentimilliaquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: QuingentimilliaquadrillionEmpirePowerSource[] = [
    'QUINGENTIMILLIAQUADRILLION_ZERO_POINT_HARVESTER',
    'QUINGENTIMILLIAQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid quingentimilliaquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < NINETY_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${NINETY_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Quingenti-Millia-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `QUINGENTIMILLIAQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Ninety-Nines (90 Nines) SLA uptime across the Quingenti-Millia-Quadrillion Singularity Mesh.
 */
export function evaluateNinetyNinesSla(
  input: NinetyNinesSlaInput
): NinetyNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? NINETY_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    NINETY_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Ninety-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.quingentimilliaquadrillionFoamSingularityActive) {
    violations.push(
      'Quingenti-Millia-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.99999999999999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.99999999999999999999999% threshold`
    );
  }

  const slaVerdict: NinetyNinesSlaVerdict =
    violations.length === 0 ? 'NINETY_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `NINETY_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
