/**
 * @file inter-galactic-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Omni-Cosmic Power & Thirty-Six-Nines (99.9999999999999999999999999999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import { THIRTY_SIX_NINES_SLA_CONSTANTS } from '@/seed/types/inter-galactic-quantum-mesh-nexus';

export type ThirtySixNinesSlaVerdict =
  | 'THIRTY_SIX_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface InterGalacticPowerInput {
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  cryoPowerMw: number;
  boseEinsteinCop: number;
}

export interface InterGalacticPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface ThirtySixNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  interGalacticZeroPointEntanglementActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface ThirtySixNinesSlaEvaluationOutput {
  slaVerdict: ThirtySixNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Inter-Galactic harvest power allocation and extreme Bose-Einstein Condensate cooling metrics.
 */
export function validateInterGalacticPower(
  input: InterGalacticPowerInput
): InterGalacticPowerValidationOutput {
  const violations: string[] = [];

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.boseEinsteinCop < THIRTY_SIX_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP) {
    violations.push(
      `Cooling COP ${input.boseEinsteinCop} is below minimum requirement ${THIRTY_SIX_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated megawatts must be strictly positive');
  }

  const isCompliant = violations.length === 0;
  const verificationHash = createHash('sha256')
    .update(
      `INTER_GALACTIC_POWER_AUDIT:${isCompliant}:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.boseEinsteinCop}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates continuous Thirty-Six-Nines (99.9999999999999999999999999999999999%) SLA uptime across the Inter-Galactic Continuum.
 */
export function evaluateThirtySixNinesSla(
  input: ThirtySixNinesSlaInput
): ThirtySixNinesSlaEvaluationOutput {
  const totalWindowNanoseconds =
    input.totalWindowNanoseconds ?? THIRTY_SIX_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowedDowntimeNanoseconds =
    THIRTY_SIX_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;

  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowedDowntimeNanoseconds) {
    violations.push(
      `Downtime ${input.actualDowntimeNanoseconds} ns exceeds allowable Thirty-Six-Nines budget of ${maxAllowedDowntimeNanoseconds} ns`
    );
  }

  if (!input.interGalacticZeroPointEntanglementActive) {
    violations.push(
      'Inter-Galactic zero-point quantum entanglement mesh link is degraded or inactive'
    );
  }

  if (input.bftQuorumConsensusPct < 99.99999) {
    violations.push(
      `BFT quorum consensus ${input.bftQuorumConsensusPct}% is below required 99.99999% threshold`
    );
  }

  const slaVerdict: ThirtySixNinesSlaVerdict =
    violations.length === 0 ? 'THIRTY_SIX_NINES_CERTIFIED' : 'BREACH_LIQUIDITY_PENALIZED';

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
      `THIRTY_SIX_NINES_SLA:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:${input.bftQuorumConsensusPct}`
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
