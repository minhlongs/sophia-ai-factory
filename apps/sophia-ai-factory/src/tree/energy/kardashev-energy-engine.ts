/**
 * @file kardashev-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Kardashev Stellar Energy & Eleven-Nines (99.999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  ELEVEN_NINES_SLA_CONSTANTS,
  type ElevenNinesSlaVerdict,
} from '@/seed/types/queccaflop-nexus';

export interface KardashevPowerInput {
  allocatedMegawatts: number;
  carbonIntensityGCo2PerKwh: number;
  cryoCoolingPowerMw: number;
  coolingEfficiencyCop: number;
}

export interface KardashevPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface ElevenNinesSlaInput {
  totalWindowMicroseconds?: number;
  actualDowntimeMicroseconds: number;
  quantumEntangledRedundancyActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface ElevenNinesSlaEvaluationOutput {
  slaVerdict: ElevenNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeMicroseconds: number;
  actualDowntimeMicroseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Kardashev stellar power allocation and extreme cryo-photonic cooling metrics.
 */
export function validateKardashevPower(input: KardashevPowerInput): KardashevPowerValidationOutput {
  const violations: string[] = [];

  if (input.carbonIntensityGCo2PerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGCo2PerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.coolingEfficiencyCop < ELEVEN_NINES_SLA_CONSTANTS.MIN_CRYO_COP) {
    violations.push(
      `Cooling COP ${input.coolingEfficiencyCop} is below minimum requirement ${ELEVEN_NINES_SLA_CONSTANTS.MIN_CRYO_COP}`
    );
  }

  if (input.allocatedMegawatts <= 0) {
    violations.push('Allocated power must be strictly positive');
  }

  if (input.cryoCoolingPowerMw <= 0) {
    violations.push('Cryo cooling power allocation must be strictly positive');
  }

  const isCompliant = violations.length === 0;

  const verificationHash = createHash('sha256')
    .update(`KARDASHEV_POWER:${input.allocatedMegawatts}:${input.carbonIntensityGCo2PerKwh}:${input.coolingEfficiencyCop}:${isCompliant}`)
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates Eleven-Nines (99.999999999%) SLA uptime at microsecond resolution.
 */
export function evaluateElevenNinesSla(input: ElevenNinesSlaInput): ElevenNinesSlaEvaluationOutput {
  const totalWindow =
    input.totalWindowMicroseconds ?? ELEVEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_MICROSECONDS;
  const maxAllowed = ELEVEN_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_MICROSECONDS;
  const violations: string[] = [];

  if (input.actualDowntimeMicroseconds > maxAllowed) {
    violations.push(
      `Actual downtime ${input.actualDowntimeMicroseconds} µs exceeds maximum allowable Eleven-Nines downtime ${maxAllowed} µs (0.02592 ms)`
    );
  }

  if (!input.quantumEntangledRedundancyActive) {
    violations.push('Quantum entangled state redundancy synchronization is inactive');
  }

  if (input.bftQuorumConsensusPct < 100.0) {
    violations.push(
      `Byzantine Fault Tolerant quorum consensus ${input.bftQuorumConsensusPct}% is below 100.0% requirement`
    );
  }

  const effectiveAvailabilityPct =
    totalWindow > 0
      ? Number((((totalWindow - input.actualDowntimeMicroseconds) / totalWindow) * 100).toFixed(9))
      : 0.0;

  const isCertified = violations.length === 0;
  const slaVerdict: ElevenNinesSlaVerdict = isCertified
    ? 'ELEVEN_NINES_CERTIFIED'
    : 'BREACH_LIQUIDITY_PENALIZED';

  const auditSignature = createHash('sha256')
    .update(`ELEVEN_NINES_AUDIT:${slaVerdict}:${input.actualDowntimeMicroseconds}:${effectiveAvailabilityPct}:${auditTimestampIso()}`)
    .digest('hex');

  return {
    slaVerdict,
    effectiveAvailabilityPct,
    maxAllowedDowntimeMicroseconds: maxAllowed,
    actualDowntimeMicroseconds: input.actualDowntimeMicroseconds,
    violations,
    auditSignature,
  };
}

function auditTimestampIso(): string {
  return '2026-09-27T00:00:00Z';
}
