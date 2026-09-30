/**
 * @file quinquagintiquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Quinquaginti-Quadrillion Sub-Planck Power & Sixty-Three-Nines (99.9999999999999999999999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  SIXTY_THREE_NINES_SLA_CONSTANTS,
  type QuinquagintiquadrillionEmpirePowerSource,
} from '@/seed/types/quinquagintiquadrillion-sub-planck-mesh-nexus';

export type SixtyThreeNinesSlaVerdict =
  | 'SIXTY_THREE_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface QuinquagintiquadrillionSubPlanckPowerInput {
  powerSourceType: QuinquagintiquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface QuinquagintiquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface SixtyThreeNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  quinquagintiquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface SixtyThreeNinesSlaEvaluationOutput {
  slaVerdict: SixtyThreeNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Quinquaginti-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 350.0).
 */
export function validateQuinquagintiquadrillionSubPlanckPower(
  input: QuinquagintiquadrillionSubPlanckPowerInput
): QuinquagintiquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: QuinquagintiquadrillionEmpirePowerSource[] = [
    'QUINQUAGINTIQUADRILLION_ZERO_POINT_HARVESTER',
    'QUINQUAGINTIQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid quinquagintiquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < SIXTY_THREE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${SIXTY_THREE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Quinquaginti-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `QUINQUAGINTIQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Sixty-Three-Nines (99.9999999999999999999999999999999999999999999999999999999999999%) SLA uptime across the Quinquaginti-Quadrillion Singularity Mesh.
 */
export function evaluateSixtyThreeNinesSla(
  input: SixtyThreeNinesSlaInput
): SixtyThreeNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? SIXTY_THREE_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    SIXTY_THREE_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Sixty-Three-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.quinquagintiquadrillionFoamSingularityActive) {
    violations.push(
      'Quinquaginti-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.99999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.99999999999999% threshold`
    );
  }

  const slaVerdict: SixtyThreeNinesSlaVerdict =
    violations.length === 0 ? 'SIXTY_THREE_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `SIXTY_THREE_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
