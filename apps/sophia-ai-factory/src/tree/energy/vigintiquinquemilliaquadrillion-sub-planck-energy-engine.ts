/**
 * @file vigintiquinquemilliaquadrillion-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Viginti-Quinque-Millia-Quadrillion (25.0 Quintillion) Sub-Planck Power & Ninety-Six-Nines (96 Nines) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  NINETY_SIX_NINES_SLA_CONSTANTS,
  type VigintiquinquemilliaquadrillionEmpirePowerSource,
} from '@/seed/types/vigintiquinquemilliaquadrillion-sub-planck-mesh-nexus';

export type NinetySixNinesSlaVerdict =
  | 'NINETY_SIX_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface VigintiquinquemilliaquadrillionSubPlanckPowerInput {
  powerSourceType: VigintiquinquemilliaquadrillionEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface VigintiquinquemilliaquadrillionSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface NinetySixNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  vigintiquinquemilliaquadrillionFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface NinetySixNinesSlaEvaluationOutput {
  slaVerdict: NinetySixNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Viginti-Quinque-Millia-Quadrillion Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 2000.0).
 */
export function validateVigintiquinquemilliaquadrillionSubPlanckPower(
  input: VigintiquinquemilliaquadrillionSubPlanckPowerInput
): VigintiquinquemilliaquadrillionSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: VigintiquinquemilliaquadrillionEmpirePowerSource[] = [
    'VIGINTIQUINQUEMILLIAQUADRILLION_ZERO_POINT_HARVESTER',
    'VIGINTIQUINQUEMILLIAQUADRILLION_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid vigintiquinquemilliaquadrillion power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < NINETY_SIX_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${NINETY_SIX_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Viginti-Quinque-Millia-Quadrillion power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `VIGINTIQUINQUEMILLIAQUADRILLION_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Ninety-Six-Nines (96 Nines) SLA uptime across the Viginti-Quinque-Millia-Quadrillion Singularity Mesh.
 */
export function evaluateNinetySixNinesSla(
  input: NinetySixNinesSlaInput
): NinetySixNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? NINETY_SIX_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    NINETY_SIX_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Ninety-Six-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.vigintiquinquemilliaquadrillionFoamSingularityActive) {
    violations.push(
      'Viginti-Quinque-Millia-Quadrillion sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.999999999999999999999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.999999999999999999999999% threshold`
    );
  }

  const slaVerdict: NinetySixNinesSlaVerdict =
    violations.length === 0 ? 'NINETY_SIX_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `NINETY_SIX_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
