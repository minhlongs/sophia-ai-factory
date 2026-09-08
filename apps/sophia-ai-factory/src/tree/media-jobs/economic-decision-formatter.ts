/**
 * @module tree/media-jobs/economic-decision-formatter
 *
 * Formats health + economic metrics into a human-readable decision output
 * for SUPREME COMMAND #9 — Phase 11.
 *
 * Pure function — takes structured metrics, returns display-ready strings
 * with UNKNOWN fallbacks for missing data.
 *
 * Layer rule: tree — imports from seed only.
 */

import type { ProviderEconomicMetrics } from './media-job-economics-aggregate';
import type { ProviderHealthAssessment } from './provider-health-policy';
import type { ProviderHealthStatus } from './provider-health-policy';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EconomicDecisionOutput {
  provider: string;
  status: ProviderHealthStatus;
  jobs: number;
  successRate: string;
  p50: string;
  p95: string;
  knownCost: string;
  unknownCostJobs: number;
  revenueAttributed: string;
  knownGrossMargin: string;
  dataConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ── Formatting Helpers ───────────────────────────────────────────────────────

function formatCents(cents: number | null): string {
  if (cents === null) return 'UNKNOWN';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPercentOrNa(value: number | null): string {
  if (value === null) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function formatPercentOrUnknown(value: number | null): string {
  if (value === null) return 'UNKNOWN';
  return `${value.toFixed(1)}%`;
}

function formatLatency(ms: number | null): string {
  if (ms === null) return 'N/A';
  return `${Math.round(ms)} ms`;
}

// ── Data Confidence ─────────────────────────────────────────────────────────

/**
 * Determine data confidence level.
 *
 * - HIGH:   totalJobs >= 100 AND knownCostJobs/totalJobs >= 0.8
 * - MEDIUM: totalJobs >= 50
 * - LOW:    otherwise
 */
function computeDataConfidence(
  totalJobs: number,
  knownCostJobs: number,
): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (totalJobs >= 100 && knownCostJobs / totalJobs >= 0.8) {
    return 'HIGH';
  }
  if (totalJobs >= 50) {
    return 'MEDIUM';
  }
  return 'LOW';
}

// ── Main Formatter ───────────────────────────────────────────────────────────

/**
 * Format health assessment + economic metrics into a decision-ready output.
 *
 * All numeric values are converted to display strings. Null economic
 * values become 'UNKNOWN'. Latencies are rounded to whole milliseconds.
 */
export function formatEconomicDecision(
  health: ProviderHealthAssessment,
  economics: ProviderEconomicMetrics,
): EconomicDecisionOutput {
  const totalJobs = economics.totalJobs;
  const knownCostJobs = economics.knownCostJobs;

  return {
    provider: health.provider,
    status: health.status,
    jobs: totalJobs,
    successRate: formatPercentOrNa(health.metrics.successRate),
    p50: formatLatency(health.metrics.p50LatencyMs),
    p95: formatLatency(health.metrics.p95LatencyMs),
    knownCost: formatCents(economics.totalKnownProviderCost),
    unknownCostJobs: economics.unknownCostJobs,
    revenueAttributed: formatCents(economics.revenueAttributed),
    knownGrossMargin: formatPercentOrUnknown(economics.knownGrossMarginPercent),
    dataConfidence: computeDataConfidence(totalJobs, knownCostJobs),
  };
}
