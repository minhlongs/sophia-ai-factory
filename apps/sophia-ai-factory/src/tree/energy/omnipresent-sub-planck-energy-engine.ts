/**
 * @file omnipresent-sub-planck-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Omnipresent Sub-Planck Power & Forty-Two-Nines (99.9999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  FORTY_TWO_NINES_SLA_CONSTANTS,
  type OmnipresentEmpirePowerSource,
} from '@/seed/types/omnipresent-sub-planck-mesh-nexus';

export type FortyTwoNinesSlaVerdict =
  | 'FORTY_TWO_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface OmnipresentSubPlanckPowerInput {
  powerSourceType: OmnipresentEmpirePowerSource;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface OmnipresentSubPlanckPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface FortyTwoNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  omnipresentFoamSingularityActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface FortyTwoNinesSlaEvaluationOutput {
  slaVerdict: FortyTwoNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Omnipresent Sub-Planck harvest power allocation and extreme Bose-Einstein Condensate cooling metrics (COP >= 100.0).
 */
export function validateOmnipresentSubPlanckPower(
  input: OmnipresentSubPlanckPowerInput
): OmnipresentSubPlanckPowerValidationOutput {
  const violations: string[] = [];

  const validSources: OmnipresentEmpirePowerSource[] = [
    'OMNIPRESENT_ZERO_POINT_HARVESTER',
    'TRANS_COSMIC_CONTINUUM_TAP',
    'SUB_PLANCK_ZERO_WELL',
  ];

  if (!validSources.includes(input.powerSourceType)) {
    violations.push(`Invalid omnipresent power source: ${input.powerSourceType}`);
  }

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < FORTY_TWO_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${FORTY_TWO_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  if (!input.isNetZeroCertified) {
    violations.push('Omnipresent power allocation must be certified net-zero');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `OMNIPRESENT_SUB_PLANCK_POWER_AUDIT:${isCompliant}:${input.powerSourceType}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}:${input.isNetZeroCertified}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Forty-Two-Nines (99.9999999999999999999999999999999999999999%) SLA uptime across the Omnipresent Singularity Mesh.
 */
export function evaluateFortyTwoNinesSla(
  input: FortyTwoNinesSlaInput
): FortyTwoNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? FORTY_TWO_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    FORTY_TWO_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Forty-Two-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.omnipresentFoamSingularityActive) {
    violations.push(
      'Omnipresent sub-planck foam singularity mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.9999999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.9999999% threshold`
    );
  }

  const slaVerdict: FortyTwoNinesSlaVerdict =
    violations.length === 0 ? 'FORTY_TWO_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `FORTY_TWO_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
