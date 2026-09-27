/**
 * @file matrioshka-power-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Matrioshka Clean Energy & Ten-Nines (99.99999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  TEN_NINES_SLA_CONSTANTS,
  type SlaVerdict,
} from '@/seed/types/ronanflop-matrix';

export interface MatrioshkaPowerInput {
  allocatedMegawatts: number;
  carbonIntensityGCo2PerKwh: number;
  cryoCoolingPowerMw: number;
  coolingEfficiencyCop: number;
}

export interface MatrioshkaPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface TenNinesSlaInput {
  totalWindowMicroseconds?: number;
  actualDowntimeMicroseconds: number;
  quantumTeleportSyncActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface TenNinesSlaEvaluationOutput {
  slaVerdict: SlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeMicroseconds: number;
  actualDowntimeMicroseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Matrioshka Brain clean power allocation and cryo-photonic cooling metrics.
 */
export function validateMatrioshkaPower(input: MatrioshkaPowerInput): MatrioshkaPowerValidationOutput {
  const violations: string[] = [];

  if (input.carbonIntensityGCo2PerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGCo2PerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.coolingEfficiencyCop < TEN_NINES_SLA_CONSTANTS.MIN_CRYO_COP) {
    violations.push(
      `Cooling COP ${input.coolingEfficiencyCop} is below minimum requirement ${TEN_NINES_SLA_CONSTANTS.MIN_CRYO_COP}`
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
    .update(`MATRIOSHKA_POWER:${input.allocatedMegawatts}:${input.carbonIntensityGCo2PerKwh}:${input.coolingEfficiencyCop}:${isCompliant}`)
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates Ten-Nines (99.99999999%) SLA uptime at microsecond resolution.
 */
export function evaluateTenNinesSla(input: TenNinesSlaInput): TenNinesSlaEvaluationOutput {
  const totalWindow =
    input.totalWindowMicroseconds ?? TEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_MICROSECONDS;
  const maxAllowed = TEN_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_MICROSECONDS;
  const violations: string[] = [];

  if (input.actualDowntimeMicroseconds > maxAllowed) {
    violations.push(
      `Actual downtime ${input.actualDowntimeMicroseconds} µs exceeds maximum allowable Ten-Nines downtime ${maxAllowed} µs (0.2592 ms)`
    );
  }

  if (!input.quantumTeleportSyncActive) {
    violations.push('Quantum teleportation state synchronization is inactive');
  }

  if (input.bftQuorumConsensusPct < 100.0) {
    violations.push(
      `Byzantine Fault Tolerant quorum consensus ${input.bftQuorumConsensusPct}% is below 100.0% requirement`
    );
  }

  const effectiveAvailabilityPct =
    totalWindow > 0
      ? Number((((totalWindow - input.actualDowntimeMicroseconds) / totalWindow) * 100).toFixed(8))
      : 0.0;

  const isCertified = violations.length === 0;
  const slaVerdict: SlaVerdict = isCertified
    ? 'TEN_NINES_CERTIFIED'
    : 'BREACH_LIQUIDITY_PENALIZED';

  const auditSignature = createHash('sha256')
    .update(`TEN_NINES_AUDIT:${slaVerdict}:${input.actualDowntimeMicroseconds}:${effectiveAvailabilityPct}:${auditTimestampIso()}`)
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
