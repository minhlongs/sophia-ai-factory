/**
 * @file dyson-swarm-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Dyson Swarm Net-Zero Power & Twelve-Nines (99.9999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import {
  TWELVE_NINES_SLA_CONSTANTS,
  type TwelveNinesSlaVerdict,
} from '@/seed/types/photonic-tachyon-nexus';

export interface DysonPowerInput {
  allocatedMegawatts: number;
  carbonIntensityGCo2PerKwh: number;
  cryoCoolingPowerMw: number;
  coolingEfficiencyCop: number;
}

export interface DysonPowerValidationOutput {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface TwelveNinesSlaInput {
  totalWindowMicroseconds?: number;
  actualDowntimeMicroseconds: number;
  tachyonEntanglementActive: boolean;
  bftQuorumConsensusPct: number;
}

export interface TwelveNinesSlaEvaluationOutput {
  slaVerdict: TwelveNinesSlaVerdict;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeMicroseconds: number;
  actualDowntimeMicroseconds: number;
  violations: string[];
  auditSignature: string;
}

/**
 * Validates Dyson Swarm stellar power allocation and extreme cryo-tachyon cooling metrics.
 */
export function validateDysonPower(
  input: DysonPowerInput
): DysonPowerValidationOutput {
  const violations: string[] = [];

  if (input.carbonIntensityGCo2PerKwh > 0.0) {
    violations.push(
      `Carbon intensity ${input.carbonIntensityGCo2PerKwh} g CO2/kWh violates absolute net-zero (0.0 required)`
    );
  }

  if (input.coolingEfficiencyCop < TWELVE_NINES_SLA_CONSTANTS.MIN_CRYO_COP) {
    violations.push(
      `Cooling COP ${input.coolingEfficiencyCop} is below minimum requirement ${TWELVE_NINES_SLA_CONSTANTS.MIN_CRYO_COP}`
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
    .update(
      `DYSON_POWER:${input.allocatedMegawatts}:${input.carbonIntensityGCo2PerKwh}:${input.coolingEfficiencyCop}:${isCompliant}`
    )
    .digest('hex');

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}

/**
 * Evaluates Twelve-Nines (99.9999999999%) SLA uptime at sub-microsecond resolution.
 */
export function evaluateTwelveNinesSla(
  input: TwelveNinesSlaInput
): TwelveNinesSlaEvaluationOutput {
  const totalWindow =
    input.totalWindowMicroseconds ??
    TWELVE_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_MICROSECONDS;
  const maxAllowed = TWELVE_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_MICROSECONDS;
  const violations: string[] = [];

  if (input.actualDowntimeMicroseconds > maxAllowed) {
    violations.push(
      `Actual downtime ${input.actualDowntimeMicroseconds} µs exceeds maximum allowable Twelve-Nines downtime ${maxAllowed} µs (0.002592 ms)`
    );
  }

  if (!input.tachyonEntanglementActive) {
    violations.push('Tachyon quantum entangled state redundancy synchronization is inactive');
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
            ((totalWindow - input.actualDowntimeMicroseconds) / totalWindow) *
            100
          ).toFixed(10)
        )
      : 0.0;

  const isCertified = violations.length === 0;
  const slaVerdict: TwelveNinesSlaVerdict = isCertified
    ? 'TWELVE_NINES_CERTIFIED'
    : 'BREACH_LIQUIDITY_PENALIZED';

  const auditSignature = createHash('sha256')
    .update(
      `TWELVE_NINES_AUDIT:${slaVerdict}:${input.actualDowntimeMicroseconds}:${effectiveAvailabilityPct}:2026-09-27T00:00:00Z`
    )
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
