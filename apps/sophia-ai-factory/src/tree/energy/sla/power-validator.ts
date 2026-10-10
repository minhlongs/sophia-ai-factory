/**
 * Power Validation Rules, COP Verification, and Cryptographic Hash
 *
 * @module tree/energy/sla/power-validator
 */

import { createHash } from 'node:crypto';
import type {
  PowerThresholds,
  PowerValidationConfig,
  PowerValidationContext,
  PowerValidationResult,
} from './types';

export function checkCarbonAndCop(
  inp: Record<string, number | string | boolean | undefined>,
  thresholds: PowerThresholds,
  violations: string[]
): { carbonIntensity: number; cop: number } {
  const carbonIntensity = (inp.carbonIntensityGPerKwh ?? inp.carbonIntensityGCo2PerKwh ?? 0.0) as number;
  const maxCarbon = thresholds.maxCarbonIntensity ?? 0.0;
  if (carbonIntensity > maxCarbon) {
    violations.push(
      `Carbon intensity ${carbonIntensity} g CO2/kWh violates absolute net-zero (${maxCarbon} required)`
    );
  }

  const cop = (inp.boseEinsteinCop ?? inp.coolingEfficiencyCop ?? inp.heliumCryoCop ?? 0.0) as number;
  if (cop < thresholds.minCop) {
    violations.push(`Cooling COP ${cop} is below minimum requirement ${thresholds.minCop}`);
  }
  return { carbonIntensity, cop };
}

export function checkAllocatedPower(
  inp: Record<string, number | string | boolean | undefined>,
  thresholds: PowerThresholds,
  violations: string[]
): number {
  const allocatedMegawatts = (inp.allocatedMegawatts ?? 0) as number;
  if (allocatedMegawatts <= 0) {
    violations.push(thresholds.positivePowerMessage ?? 'Allocated power must be strictly positive');
  }

  const cryoPower = (inp.cryoPowerMw ?? inp.cryoCoolingPowerMw) as number | undefined;
  if (cryoPower !== undefined && cryoPower <= 0) {
    violations.push(thresholds.positiveCryoPowerMessage ?? 'Cryo cooling power allocation must be strictly positive');
  }
  return allocatedMegawatts;
}

export function checkPowerSourceAndCert(
  inp: Record<string, number | string | boolean | undefined>,
  thresholds: PowerThresholds,
  violations: string[]
): { powerSourceType: string | undefined; isNetZeroCertified: boolean | undefined } {
  const powerSourceType = inp.powerSourceType as string | undefined;
  if (thresholds.powerSourceWhitelist && powerSourceType && !thresholds.powerSourceWhitelist.includes(powerSourceType)) {
    violations.push(
      thresholds.invalidPowerSourceMessageFn
        ? thresholds.invalidPowerSourceMessageFn(powerSourceType)
        : `Power source type ${powerSourceType} is not in authorized green power whitelist`
    );
  }

  const isNetZeroCertified = inp.isNetZeroCertified as boolean | undefined;
  if (thresholds.requireNetZeroCertification && !isNetZeroCertified) {
    violations.push(thresholds.netZeroCertificationMessage ?? 'Power allocation must be certified net-zero');
  }
  return { powerSourceType, isNetZeroCertified };
}

export function computePowerVerificationHash(
  ctx: PowerValidationContext,
  config: PowerValidationConfig
): string {
  if (config.powerHashFn) {
    return config.powerHashFn(ctx);
  }
  const prefix = config.hashPrefix ?? 'POWER';
  return createHash('sha256')
    .update(`${prefix}:${ctx.allocatedMegawatts}:${ctx.carbonIntensity}:${ctx.cop}:${ctx.isCompliant}`)
    .digest('hex');
}

/**
 * Parameterized validator for Net-Zero power sources and cryo-cooling COP.
 */
export function validateParameterizedPower<T = unknown>(
  input: T,
  thresholds: PowerThresholds,
  config: PowerValidationConfig = {}
): PowerValidationResult {
  const inp = input as Record<string, number | string | boolean | undefined>;
  const violations: string[] = [];

  const { carbonIntensity, cop } = checkCarbonAndCop(inp, thresholds, violations);
  const allocatedMegawatts = checkAllocatedPower(inp, thresholds, violations);
  const { powerSourceType, isNetZeroCertified } = checkPowerSourceAndCert(inp, thresholds, violations);

  const isCompliant = violations.length === 0;

  const ctx: PowerValidationContext = {
    allocatedMegawatts,
    carbonIntensity,
    cop,
    isCompliant,
    powerSourceType,
    isNetZeroCertified,
  };

  const verificationHash = computePowerVerificationHash(ctx, config);

  return {
    isCompliant,
    violations,
    verificationHash,
  };
}
