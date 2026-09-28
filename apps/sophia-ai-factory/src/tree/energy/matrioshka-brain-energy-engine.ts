/**
 * @file matrioshka-brain-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Matrioshka Brain Net-Zero Power & Thirteen-Nines (99.99999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import { THIRTEEN_NINES_SLA_CONSTANTS } from '@/seed/types/quantum-superconducting-nexus';

export type ThirteenNinesSlaVerdict =
  | 'THIRTEEN_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface MatrioshkaPowerInput {
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  cryoPowerMw: number;
  heliumCryoCop: number;
}

export interface MatrioshkaPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface ThirteenNinesSlaInput {
  totalWindowNanoseconds?: number;
  actualDowntimeNanoseconds: number;
  quantumEntanglementActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface ThirteenNinesSlaEvaluationOutput {
  slaVerdict: ThirteenNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds: number;
  actualDowntimeNanoseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Matrioshka Brain stellar power allocation and extreme helium cryo cooling metrics.
 */
export function validateMatrioshkaPower(
  input: MatrioshkaPowerInput
): MatrioshkaPowerValidationOutput {
  const violations: string[] = [];

  if (input.carbonIntensityGPerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGPerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.heliumCryoCop < THIRTEEN_NINES_SLA_CONSTANTS.MIN_HELIUM_CRYO_COP) {
    violations.push(
      `Cooling COP ${input.heliumCryoCop} is below minimum requirement ${THIRTEEN_NINES_SLA_CONSTANTS.MIN_HELIUM_CRYO_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated power must be strictly positive');
  }

  if (input.cryoPowerMw <= 0) {
    violations.push('Cryo cooling power allocation must be strictly positive');
  }

  const isCompliant = violations.length === 0;

  const verificationHash = createHash('sha256')
    .update(
      `MATRIOSHKA_POWER:${input.allocatedMegawatts}:${input.carbonIntensityGPerKwh}:${input.heliumCryoCop}:${isCompliant}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates Thirteen-Nines (99.99999999999%) SLA uptime at sub-microsecond/nanosecond resolution.
 */
export function evaluateThirteenNinesSla(
  input: ThirteenNinesSlaInput
): ThirteenNinesSlaEvaluationOutput {
  const totalWindow =
    input.totalWindowNanoseconds ??
    THIRTEEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS;
  const maxAllowed = THIRTEEN_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS;
  const violations: string[] = [];

  if (input.actualDowntimeNanoseconds > maxAllowed) {
    violations.push(
      `Actual downtime ${input.actualDowntimeNanoseconds} ns exceeds maximum allowable Thirteen-Nines downtime ${maxAllowed} ns (0.2592 µs)`
    );
  }

  if (!input.quantumEntanglementActive) {
    violations.push('Quantum entangled state redundancy synchronization is inactive');
  }

  if (input.bftQuorumConsensusPct < 100.0) {
    violations.push(
      `Byzantine Fault Tolerant quorum consensus ${input.bftQuorumConsensusPct}% is below 100.0% requirement`
    );
  }

  const effectiveAvailabilityPct =
    totalWindow > 0
      ? Number(
          (
            ((totalWindow - input.actualDowntimeNanoseconds) / totalWindow) *
            100
          ).toFixed(11)
        )
      : 0.0;

  const isCertified = violations.length === 0;
  const slaVerdict: ThirteenNinesSlaVerdict = isCertified
    ? 'THIRTEEN_NINES_CERTIFIED'
    : 'BREACH_LIQUIDITY_PENALIZED';

  const auditSignature = createHash('sha256')
    .update(
      `THIRTEEN_NINES_AUDIT:${slaVerdict}:${input.actualDowntimeNanoseconds}:${effectiveAvailabilityPct}:2026-09-28T00:00:00Z`
    )
    .digest('hex');

  return {
    slaVerdict,
    effectiveAvailabilityPct,
    maxAllowedDowntimeNanoseconds: maxAllowed,
    actualDowntimeNanoseconds: input.actualDowntimeNanoseconds,
    violations,
    auditSignature,
  };
}
