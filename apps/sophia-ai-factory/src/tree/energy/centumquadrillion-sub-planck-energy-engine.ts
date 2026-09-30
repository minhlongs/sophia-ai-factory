/**
 * @file centumquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Centum-Quadrillion Sub-Planck Power & Sixty-Six-Nines (99.9999999999999999999999999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  SIXTY_SIX_NINES_SLA_CONSTANTS,
  type CentumquadrillionEmpirePowerSource,
} from '@/seed/types/centumquadrillion-sub-planck-mesh-nexus';

export type SixtySixNinesSlaVerdict =
  | 'SIXTY_SIX_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface CentumquadrillionSubPlanckPowerInput {
  powerSourceType: CentumquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface CentumquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface SixtySixNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  centumquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface SixtySixNinesSlaEvaluationOutput {
  slaVerdict: SixtySixNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Centum-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 400.0).
 */
export function validateCentumquadrillionSubPlanckPower(
  input: CentumquadrillionSubPlanckPowerInput
): CentumquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: CentumquadrillionEmpirePowerSource[] = [
    'CENTUMQUADRILLION_ZERO_POINT_HARVESTER',
    'CENTUMQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid centumquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < SIXTY_SIX_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${SIXTY_SIX_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Centum-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `CENTUMQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Sixty-Six-Nines (99.9999999999999999999999999999999999999999999999999999999999999999%) SLA uptime across the Centum-Quadrillion Singularity Mesh.
 */
export function evaluateSixtySixNinesSla(
  input: SixtySixNinesSlaInput
): SixtySixNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? SIXTY_SIX_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    SIXTY_SIX_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Sixty-Six-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.centumquadrillionFoamSingularityActive) {
    violations.push(
      'Centum-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.999999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.999999999999999% threshold`
    );
  }

  const slaVerdict: SixtySixNinesSlaVerdict =
    violations.length === 0 ? 'SIXTY_SIX_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `SIXTY_SIX_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
