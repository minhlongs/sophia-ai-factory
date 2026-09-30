/**
 * @file ducentiquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Ducenti-Quadrillion Sub-Planck Power & Sixty-Nine-Nines (99.9999999999999999999999999999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  SIXTY_NINE_NINES_SLA_CONSTANTS,
  type DucentiquadrillionEmpirePowerSource,
} from '@/seed/types/ducentiquadrillion-sub-planck-mesh-nexus';

export type SixtyNineNinesSlaVerdict =
  | 'SIXTY_NINE_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface DucentiquadrillionSubPlanckPowerInput {
  powerSourceType: DucentiquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface DucentiquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface SixtyNineNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  ducentiquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface SixtyNineNinesSlaEvaluationOutput {
  slaVerdict: SixtyNineNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Ducenti-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 450.0).
 */
export function validateDucentiquadrillionSubPlanckPower(
  input: DucentiquadrillionSubPlanckPowerInput
): DucentiquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: DucentiquadrillionEmpirePowerSource[] = [
    'DUCENTIQUADRILLION_ZERO_POINT_HARVESTER',
    'DUCENTIQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid ducentiquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < SIXTY_NINE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${SIXTY_NINE_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Ducenti-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `DUCENTIQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Sixty-Nine-Nines (99.9999999999999999999999999999999999999999999999999999999999999999999%) SLA uptime across the Ducenti-Quadrillion Singularity Mesh.
 */
export function evaluateSixtyNineNinesSla(
  input: SixtyNineNinesSlaInput
): SixtyNineNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? SIXTY_NINE_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    SIXTY_NINE_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Sixty-Nine-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.ducentiquadrillionFoamSingularityActive) {
    violations.push(
      'Ducenti-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.9999999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.9999999999999999% threshold`
    );
  }

  const slaVerdict: SixtyNineNinesSlaVerdict =
    violations.length === 0 ? 'SIXTY_NINE_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

  const effectiveAvailabilityPct =
    totalWindowNanoseconds > 0
      ? Number(
          (
            ((totalWindowNanoseconds - input.actualDowntimeNanoseconds) / totalWindowNanoseconds) *
            100
          ).toFixed(19)
        )
      : 100.0;

  const auditSignature = createHash('sha256')
    .update(
      `SIXTY_NINE_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
