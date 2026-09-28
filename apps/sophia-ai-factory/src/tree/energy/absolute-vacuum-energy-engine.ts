/**
 * @file absolute-vacuum-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Absolute Vacuum Power & Nineteen-Nines (99.99999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import { NINETEEN_NINES_SLA_CONSTANTS } from '@/seed/types/absolute-vacuum-singularity-nexus';

export type NineteenNinesSlaVerdict =
  | 'NINETEEN_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface AbsoluteVacuumPowerInput {
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  cryoPowerMw: number;
  boseEinsteinCop: number;
}

export interface AbsoluteVacuumPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface NineteenNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  absoluteZeroPointEntanglementActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface NineteenNinesSlaEvaluationOutput {
  slaVerdict: NineteenNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Absolute Vacuum harvest power allocation and extreme Bose-Einstein Condensate cooling metrics.
 */
export function validateAbsoluteVacuumPower(
  input: AbsoluteVacuumPowerInput
): AbsoluteVacuumPowerValidationOutput {
  const violations: string[] = [];

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < NINETEEN_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${NINETEEN_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `ABSOLUTE_VACUUM_POWER_AUDIT:${isCompliant}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Nineteen-Nines (99.99999999999999999%) SLA uptime across the Pan-Galactic Continuum.
 */
export function evaluateNineteenNinesSla(
  input: NineteenNinesSlaInput
): NineteenNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? NINETEEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    NINETEEN_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Nineteen-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.absoluteZeroPointEntanglementActive) {
    violations.push('Absolute zero-point quantum vacuum entanglement is not active');
  }

  if (input.bftQuorumConsensusPct < 99.999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below 99.999% threshold`
    );
  }

  const isCertified = violations.length === 0;
  const slaVerdict: NineteenNinesSlaVerdict = isCertified
    ? 'NINETEEN_NINES_CERTIFIED'
    : 'BREACH_LIQUIDITY_PENALIZED';

  const effectiveAvailabilityPct =
    totalWindowNanoseconds > 0
      ? Number(
          (
            ((totalWindowNanoseconds - input.actualDowntimeNanoseconds) /
              totalWindowNanoseconds) *
            100
          ).toFixed(17)
        )
      : 100.0;

  const auditSignature = createHash('sha256')
    .update(
      `NINETEEN_NINES_SLA_AUDIT:${slaVerdict}:${effectiveAvailabilityPct}:${input.actualDowntimeNanoseconds}:${input.absoluteZeroPointEntanglementActive}`
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
