/**
 * Deterministic economic telemetry, integer micro-USD unit economics,
 * Wilson 95% confidence intervals, and explicitly labeled sensitivity scenarios.
 *
 * All currency values use integer micro-USD (1 USD = 1,000,000 microUsd).
 *
 * @module land/eval/first-value-benchmark/telemetry-and-economics
 */

import type { MetricMeasurement } from './types';

export const MICRO_USD_PER_USD = 1_000_000;

export function assertSafeIntegerMicroUsd(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer in micro-USD, received ${String(value)}`);
  }
  return value;
}

export function formatMicroUsdAsUsd(microUsd: number): string {
  assertSafeIntegerMicroUsd(microUsd, 'microUsd');
  const sign = microUsd < 0 ? '-' : '';
  const abs = Math.abs(microUsd);
  const whole = Math.floor(abs / MICRO_USD_PER_USD);
  const frac = String(abs % MICRO_USD_PER_USD).padStart(6, '0');
  return `${sign}$${whole}.${frac}`;
}

export function computePercentile(
  observedValues: readonly number[],
  percentile: number,
): MetricMeasurement<number> {
  if (percentile <= 0 || percentile > 100) {
    throw new Error(`Percentile must be in (0, 100], got ${percentile}`);
  }
  if (observedValues.length === 0) {
    return { status: 'NOT_MEASURED', reason: 'no_observed_samples' };
  }
  const sorted = [...observedValues].sort((a, b) => a - b);
  const rank = Math.ceil((percentile / 100) * sorted.length) - 1;
  const idx = Math.max(0, Math.min(sorted.length - 1, rank));
  return { status: 'OBSERVED', value: sorted[idx] };
}

export interface WilsonInterval {
  readonly status: 'COMPUTED' | 'INSUFFICIENT_DATA';
  readonly rate: number | null;
  readonly lower95: number | null;
  readonly upper95: number | null;
  readonly successes: number;
  readonly trials: number;
}

/**
 * 95% Wilson score confidence interval for binomial acceptance rate (z = 1.959963984540054).
 */
export function computeWilsonInterval(successes: number, trials: number): WilsonInterval {
  if (!Number.isInteger(successes) || !Number.isInteger(trials) || trials < 0 || successes < 0 || successes > trials) {
    throw new Error(`Invalid binomial counts: successes=${successes}, trials=${trials}`);
  }
  if (trials === 0) {
    return { status: 'INSUFFICIENT_DATA', rate: null, lower95: null, upper95: null, successes: 0, trials: 0 };
  }
  const z = 1.959963984540054;
  const z2 = z * z;
  const p = successes / trials;
  const denom = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denom;
  return {
    status: 'COMPUTED',
    rate: Math.round(p * 10_000) / 10_000,
    lower95: Math.round(Math.max(0, center - margin) * 10_000) / 10_000,
    upper95: Math.round(Math.min(1, center + margin) * 10_000) / 10_000,
    successes,
    trials,
  };
}

export type CostPerAcceptedResult =
  | { readonly status: 'COMPUTED'; readonly microUsd: number }
  | { readonly status: 'UNDEFINED_ZERO_ACCEPTED'; readonly microUsd: null; readonly reason: string }
  | { readonly status: 'NOT_MEASURED'; readonly microUsd: null; readonly reason: string };

export function computeCostPerAcceptedDeliverable(
  totalAttributableVariableCostMicroUsd: number,
  acceptedDeliverables: number,
): CostPerAcceptedResult {
  assertSafeIntegerMicroUsd(totalAttributableVariableCostMicroUsd, 'totalAttributableVariableCostMicroUsd');
  if (totalAttributableVariableCostMicroUsd < 0) {
    throw new Error('totalAttributableVariableCostMicroUsd cannot be negative');
  }
  if (!Number.isInteger(acceptedDeliverables) || acceptedDeliverables < 0) {
    throw new Error('acceptedDeliverables must be a non-negative integer');
  }
  if (acceptedDeliverables === 0) {
    return {
      status: 'UNDEFINED_ZERO_ACCEPTED',
      microUsd: null,
      reason: 'zero_accepted_deliverables_division_prevented',
    };
  }
  return {
    status: 'COMPUTED',
    microUsd: Math.round(totalAttributableVariableCostMicroUsd / acceptedDeliverables),
  };
}

export type ContributionMarginResult =
  | { readonly status: 'ESTABLISHED'; readonly contributionPerAcceptedMicroUsd: number }
  | { readonly status: 'NOT_ESTABLISHED'; readonly contributionPerAcceptedMicroUsd: null; readonly reason: string };

export function computeContributionPerAcceptedDeliverable(
  realizedAttributableRevenueMicroUsd: number | null,
  attributableVariableCostMicroUsd: number,
  acceptedDeliverables: number,
): ContributionMarginResult {
  assertSafeIntegerMicroUsd(attributableVariableCostMicroUsd, 'attributableVariableCostMicroUsd');
  if (attributableVariableCostMicroUsd < 0) {
    throw new Error('attributableVariableCostMicroUsd cannot be negative');
  }
  if (realizedAttributableRevenueMicroUsd === null || realizedAttributableRevenueMicroUsd <= 0) {
    return {
      status: 'NOT_ESTABLISHED',
      contributionPerAcceptedMicroUsd: null,
      reason: 'no_realized_customer_revenue',
    };
  }
  assertSafeIntegerMicroUsd(realizedAttributableRevenueMicroUsd, 'realizedAttributableRevenueMicroUsd');
  if (!Number.isInteger(acceptedDeliverables) || acceptedDeliverables <= 0) {
    return {
      status: 'NOT_ESTABLISHED',
      contributionPerAcceptedMicroUsd: null,
      reason: 'zero_accepted_deliverables',
    };
  }
  const netMicroUsd = realizedAttributableRevenueMicroUsd - attributableVariableCostMicroUsd;
  return {
    status: 'ESTABLISHED',
    contributionPerAcceptedMicroUsd: Math.round(netMicroUsd / acceptedDeliverables),
  };
}

export interface SensitivityAssumptionInput {
  readonly scenarioLabel: string;
  readonly assumedAcceptanceRate: number;
  readonly assumedInferenceCostPerRunMicroUsd: number;
  readonly assumedInfraCostPerRunMicroUsd: number;
  readonly assumedRevenuePerAcceptedMicroUsd: number | null;
}

export interface SensitivityScenarioOutput {
  readonly classification: 'ASSUMPTION_ONLY_NOT_AUDITED';
  readonly scenarioLabel: string;
  readonly assumedAcceptanceRate: number;
  readonly assumedCostPerAcceptedMicroUsd: number | null;
  readonly assumedContributionPerAcceptedMicroUsd: number | null;
  readonly contributionStatus: 'HYPOTHETICAL_ONLY' | 'NOT_ESTABLISHED';
}

export function buildSensitivityScenarios(
  assumptions: readonly SensitivityAssumptionInput[],
): readonly SensitivityScenarioOutput[] {
  return assumptions.map((item) => {
    assertSafeIntegerMicroUsd(item.assumedInferenceCostPerRunMicroUsd, 'assumedInferenceCostPerRunMicroUsd');
    assertSafeIntegerMicroUsd(item.assumedInfraCostPerRunMicroUsd, 'assumedInfraCostPerRunMicroUsd');
    if (item.assumedInferenceCostPerRunMicroUsd < 0 || item.assumedInfraCostPerRunMicroUsd < 0) {
      throw new Error('Sensitivity scenario assumed costs cannot be negative');
    }
    if (item.assumedAcceptanceRate <= 0 || item.assumedAcceptanceRate > 1) {
      return {
        classification: 'ASSUMPTION_ONLY_NOT_AUDITED',
        scenarioLabel: item.scenarioLabel,
        assumedAcceptanceRate: item.assumedAcceptanceRate,
        assumedCostPerAcceptedMicroUsd: null,
        assumedContributionPerAcceptedMicroUsd: null,
        contributionStatus: 'NOT_ESTABLISHED',
      };
    }
    const perRun = item.assumedInferenceCostPerRunMicroUsd + item.assumedInfraCostPerRunMicroUsd;
    const costPerAccepted = Math.round(perRun / item.assumedAcceptanceRate);
    if (item.assumedRevenuePerAcceptedMicroUsd === null) {
      return {
        classification: 'ASSUMPTION_ONLY_NOT_AUDITED',
        scenarioLabel: item.scenarioLabel,
        assumedAcceptanceRate: item.assumedAcceptanceRate,
        assumedCostPerAcceptedMicroUsd: costPerAccepted,
        assumedContributionPerAcceptedMicroUsd: null,
        contributionStatus: 'NOT_ESTABLISHED',
      };
    }
    assertSafeIntegerMicroUsd(item.assumedRevenuePerAcceptedMicroUsd, 'assumedRevenuePerAcceptedMicroUsd');
    return {
      classification: 'ASSUMPTION_ONLY_NOT_AUDITED',
      scenarioLabel: item.scenarioLabel,
      assumedAcceptanceRate: item.assumedAcceptanceRate,
      assumedCostPerAcceptedMicroUsd: costPerAccepted,
      assumedContributionPerAcceptedMicroUsd: item.assumedRevenuePerAcceptedMicroUsd - costPerAccepted,
      contributionStatus: 'HYPOTHETICAL_ONLY',
    };
  });
}
