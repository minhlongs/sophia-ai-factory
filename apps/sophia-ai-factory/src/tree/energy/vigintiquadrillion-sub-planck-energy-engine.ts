/**
 * @file vigintiquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Viginti-Quadrillion Sub-Planck Power & Sixty-Nines (99.9999999999999999999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  SIXTY_NINES_SLA_CONSTANTS,
  type VigintiquadrillionEmpirePowerSource,
} from '@/seed/types/vigintiquadrillion-sub-planck-mesh-nexus';

export type SixtyNinesSlaVerdict =
  | 'SIXTY_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface VigintiquadrillionSubPlanckPowerInput {
  powerSourceType: VigintiquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface VigintiquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface SixtyNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  vigintiquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface SixtyNinesSlaEvaluationOutput {
  slaVerdict: SixtyNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Viginti-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 300.0).
 */
export function validateVigintiquadrillionSubPlanckPower(
  input: VigintiquadrillionSubPlanckPowerInput
): VigintiquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: VigintiquadrillionEmpirePowerSource[] = [
    'VIGINTIQUADRILLION_ZERO_POINT_HARVESTER',
    'VIGINTIQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid vigintiquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < SIXTY_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${SIXTY_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Viginti-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `VIGINTIQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Sixty-Nines (99.9999999999999999999999999999999999999999999999999999999999%) SLA uptime across the Viginti-Quadrillion Singularity Mesh.
 */
export function evaluateSixtyNinesSla(
  input: SixtyNinesSlaInput
): SixtyNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? SIXTY_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    SIXTY_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Sixty-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.vigintiquadrillionFoamSingularityActive) {
    violations.push(
      'Viginti-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.9999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.9999999999999% threshold`
    );
  }

  const slaVerdict: SixtyNinesSlaVerdict =
    violations.length === 0 ? 'SIXTY_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `SIXTY_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
