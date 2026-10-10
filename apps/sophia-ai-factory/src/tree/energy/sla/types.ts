/**
 * Types and interfaces for Net-Zero Power Validation and Multi-Nines SLA Auditing
 *
 * @module tree/energy/sla/types
 */

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
