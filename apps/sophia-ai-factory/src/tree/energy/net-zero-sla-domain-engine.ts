/**
 * @file net-zero-sla-domain-engine.ts
 * @layer tree/energy
 * @description Canonical parameterized domain engine for Net-Zero Power Validation & Multi-Nines SLA Auditing.
 */

import { createHash } from 'node:crypto';

export interface PowerValidationInput {
  allocatedMegawatts: number;
  carbonIntensityGPerKwh?: number;
  carbonIntensityGCo2PerKwh?: number;
  cryoPowerMw?: number;
  cryoCoolingPowerMw?: number;
  boseEinsteinCop?: number;
  coolingEfficiencyCop?: number;
  heliumCryoCop?: number;
  powerSourceType?: string;
  isNetZeroCertified?: boolean;
}

export interface PowerThresholds {
  maxCarbonIntensity?: number;
  minCop: number;
  powerSourceWhitelist?: string[];
  invalidPowerSourceMessageFn?: (source: string) => string;
  requireNetZeroCertification?: boolean;
  netZeroCertificationMessage?: string;
  positivePowerMessage?: string;
  positiveCryoPowerMessage?: string;
}

export interface PowerValidationContext {
  allocatedMegawatts: number;
  carbonIntensity: number;
  cop: number;
  isCompliant: boolean;
  powerSourceType?: string;
  isNetZeroCertified?: boolean;
}

export interface PowerValidationConfig {
  hashPrefix?: string;
  powerHashFn?: (ctx: PowerValidationContext) => string;
}

export interface PowerValidationResult {
  isCompliant: boolean;
  violations: string[];
  verificationHash: string;
}

export interface MultiNinesSlaInput {
  actualDowntime?: number;
  actualDowntimeNanoseconds?: number;
  actualDowntimeMicroseconds?: number;
  actualDowntimeAttoseconds?: number;
  actualDowntimeZeptoseconds?: number;
  totalWindow?: number;
  totalWindowNanoseconds?: number;
  totalWindowMicroseconds?: number;
  entanglementActive?: boolean;
  tachyonEntanglementActive?: boolean;
  anyonicEntanglementActive?: boolean;
  quantumEntanglementActive?: boolean;
  bftQuorumConsensusPct?: number;
}

export interface MultiNinesSlaThresholds {
  maxAllowedDowntime: number;
  totalWindow?: number;
  minBftQuorumPct?: number;
  certifiedVerdict: string;
  breachVerdict?: string;
  precision?: number;
  slaName?: string;
  timeUnit?: string;
  downtimeViolationFormatter?: (actual: number, max: number) => string;
  entanglementActiveGetter?: (input: Record<string, unknown>) => boolean | undefined;
  entanglementViolationMessage?: string;
  minBftViolationFormatter?: (actual: number, min: number) => string;
}

export interface SlaAuditContext {
  slaVerdict: string;
  actualDowntime: number;
  effectiveAvailabilityPct: number;
  maxAllowedDowntime: number;
  bftQuorumPct?: number;
  timestampIso?: string;
}

export interface MultiNinesSlaConfig {
  hashPrefix?: string;
  timestampIso?: string;
  auditSignatureFn?: (ctx: SlaAuditContext) => string;
}

export interface MultiNinesSlaResult {
  slaVerdict: string;
  effectiveAvailabilityPct: number;
  maxAllowedDowntimeNanoseconds?: number;
  maxAllowedDowntimeMicroseconds?: number;
  actualDowntimeNanoseconds?: number;
  actualDowntimeMicroseconds?: number;
  actualDowntimeAttoseconds?: number;
  violations: string[];
  auditSignature: string;
}

function checkCarbonAndCop(
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

function checkAllocatedPower(
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

function checkPowerSourceAndCert(
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

function computePowerVerificationHash(
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

function checkDowntimeViolation(
  actualDowntime: number,
  maxAllowed: number,
  thresholds: MultiNinesSlaThresholds,
  violations: string[]
): void {
  if (actualDowntime > maxAllowed) {
    if (thresholds.downtimeViolationFormatter) {
      violations.push(thresholds.downtimeViolationFormatter(actualDowntime, maxAllowed));
    } else if (thresholds.slaName) {
      const unit = thresholds.timeUnit ?? 'ns';
      violations.push(
        `Actual downtime ${actualDowntime} ${unit} exceeds maximum allowable ${thresholds.slaName} downtime ${maxAllowed} ${unit}`
      );
    } else {
      violations.push(`Actual downtime ${actualDowntime} exceeds maximum allowable SLA downtime ${maxAllowed}`);
    }
  }
}

function resolveEntanglementStatus(
  inp: Record<string, unknown>,
  thresholds: MultiNinesSlaThresholds
): boolean | undefined {
  if (thresholds.entanglementActiveGetter) {
    return thresholds.entanglementActiveGetter(inp);
  }
  const rawEnt =
    inp.entanglementActive ??
    inp.tachyonEntanglementActive ??
    inp.anyonicEntanglementActive ??
    inp.quantumEntanglementActive;
  if (rawEnt !== undefined) {
    return Boolean(rawEnt);
  }
  for (const k of Object.keys(inp)) {
    if (k.endsWith('EntanglementActive') || k.endsWith('SingularityActive')) {
      return Boolean(inp[k]);
    }
  }
  return undefined;
}

function checkEntanglementAndQuorum(
  inp: Record<string, unknown>,
  thresholds: MultiNinesSlaThresholds,
  violations: string[]
): number | undefined {
  const isEntanglementActive = resolveEntanglementStatus(inp, thresholds);
  if (isEntanglementActive !== undefined && !isEntanglementActive) {
    if (thresholds.entanglementViolationMessage) {
      violations.push(thresholds.entanglementViolationMessage);
    } else if (inp.anyonicEntanglementActive !== undefined) {
      violations.push('Anyonic topological entangled state redundancy synchronization is inactive');
    } else {
      violations.push('Quantum entangled state redundancy synchronization is inactive');
    }
  }

  const minQuorum = thresholds.minBftQuorumPct ?? 100.0;
  const bftQuorumPct = typeof inp.bftQuorumConsensusPct === 'number' ? inp.bftQuorumConsensusPct : undefined;
  if (bftQuorumPct !== undefined && bftQuorumPct < minQuorum) {
    if (thresholds.minBftViolationFormatter) {
      violations.push(thresholds.minBftViolationFormatter(bftQuorumPct, minQuorum));
    } else {
      violations.push(`Byzantine Fault Tolerant quorum consensus ${bftQuorumPct}% is below ${minQuorum.toFixed(1)}% requirement`);
    }
  }
  return bftQuorumPct;
}

function computeSlaAuditSignature(
  ctx: SlaAuditContext,
  config: MultiNinesSlaConfig
): string {
  if (config.auditSignatureFn) {
    return config.auditSignatureFn(ctx);
  }
  const prefix = config.hashPrefix ?? 'SLA_AUDIT';
  return createHash('sha256')
    .update(`${prefix}:${ctx.slaVerdict}:${ctx.actualDowntime}:${ctx.effectiveAvailabilityPct}:${ctx.timestampIso}`)
    .digest('hex');
}

/**
 * Parameterized evaluator for extreme multi-nines availability SLA.
 */
export function evaluateParameterizedMultiNinesSla<T = unknown>(
  input: T,
  thresholds: MultiNinesSlaThresholds,
  config: MultiNinesSlaConfig = {}
): MultiNinesSlaResult {
  const inp = input as Record<string, unknown>;
  const actualDowntime = Number(
    inp.actualDowntime ??
    inp.actualDowntimeNanoseconds ??
    inp.actualDowntimeMicroseconds ??
    inp.actualDowntimeAttoseconds ??
    inp.actualDowntimeZeptoseconds ??
    0
  );

  const maxAllowed = thresholds.maxAllowedDowntime;
  const totalWindow = Number(
    inp.totalWindow ??
    inp.totalWindowNanoseconds ??
    inp.totalWindowMicroseconds ??
    thresholds.totalWindow ??
    2_592_000_000_000_000 // default 30 days in ns
  );

  const violations: string[] = [];
  checkDowntimeViolation(actualDowntime, maxAllowed, thresholds, violations);
  const bftQuorumPct = checkEntanglementAndQuorum(inp, thresholds, violations);

  const precision = thresholds.precision ?? 10;
  const effectiveAvailabilityPct =
    totalWindow > 0
      ? Number((((totalWindow - actualDowntime) / totalWindow) * 100).toFixed(precision))
      : 0.0;

  const isCertified = violations.length === 0;
  const slaVerdict = isCertified
    ? thresholds.certifiedVerdict
    : (thresholds.breachVerdict ?? 'BREACH_LIQUIDITY_PENALIZED');

  const timestamp = config.timestampIso ?? '2026-09-28T00:00:00Z';

  const ctx: SlaAuditContext = {
    slaVerdict,
    actualDowntime,
    effectiveAvailabilityPct,
    maxAllowedDowntime: maxAllowed,
    bftQuorumPct,
    timestampIso: timestamp,
  };

  const auditSignature = computeSlaAuditSignature(ctx, config);

  return {
    slaVerdict,
    effectiveAvailabilityPct,
    maxAllowedDowntimeNanoseconds: maxAllowed,
    maxAllowedDowntimeMicroseconds: maxAllowed,
    actualDowntimeNanoseconds: actualDowntime,
    actualDowntimeMicroseconds: actualDowntime,
    actualDowntimeAttoseconds: actualDowntime,
    violations,
    auditSignature,
  };
}
