/**
 * @file dyson-swarm-energy-engine.ts
 * @layer tree/energy
 * @description Pure domain engine for Dyson Swarm Net-Zero Power & Twelve-Nines (99.9999999999%) SLA Guarantee.
 */

import { createHash } from 'node:crypto';
import { TWELVE_NINES_SLA_CONSTANTS } from '@/seed/types/photonic-tachyon-nexus';
import {
  evaluateTwelveNinesSla,
  type TwelveNinesSlaInput,
  type TwelveNinesSlaEvaluationOutput,
} from './twelve-nines-sla-evaluator';

export {
  evaluateTwelveNinesSla,
  type TwelveNinesSlaInput,
  type TwelveNinesSlaEvaluationOutput,
};

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
