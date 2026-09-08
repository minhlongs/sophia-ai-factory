/**
 * @module tree/media-jobs/media-job-economics-aggregate
 *
 * Provider economic metrics aggregation (SUPREME COMMAND #9 — Phase 5).
 *
 * Pure functions that aggregate economic data from media_jobs rows.
 *
 * Layer rule: tree — imports from seed only.
 */

import { CostClassification } from '@/seed/types/creative-job-economics';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MediaJobEconomicRow {
  status: string;
  provider_cost: number | null;
  cost_classification: string | null;
  revenue_attribution: number | null;
  gross_margin: number | null;
}

export interface ProviderEconomicMetrics {
  provider: string;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  knownCostJobs: number;
  unknownCostJobs: number;
  totalKnownProviderCost: number | null;
  averageKnownCostPerJob: number | null;
  revenueAttributed: number | null;
  knownGrossMarginPercent: number | null;
  dataConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Aggregate economic metrics from raw media_jobs rows.
 *
 * Key rules:
 * - Never sum NULLs as zero
 * - Gross margin NULL unless computable
 * - averageKnownCostPerJob = totalKnown / knownCostJobs, null if no METERED jobs
 */
export function aggregateEconomicMetrics(
  rows: MediaJobEconomicRow[],
  provider: string = 'unknown',
): ProviderEconomicMetrics {
  const totalJobs = rows.length;

  if (totalJobs === 0) {
    return {
      provider,
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      knownCostJobs: 0,
      unknownCostJobs: 0,
      totalKnownProviderCost: null,
      averageKnownCostPerJob: null,
      revenueAttributed: null,
      knownGrossMarginPercent: null,
      dataConfidence: 'LOW',
    };
  }

  const successfulJobs = rows.filter((r) => r.status === 'completed').length;
  const failedJobs = rows.filter((r) => r.status === 'failed').length;

  // Cost classification breakdown
  const knownCostJobs = rows.filter(
    (r) => r.cost_classification === CostClassification.METERED,
  ).length;
  const unknownCostJobs = rows.filter(
    (r) =>
      r.cost_classification === CostClassification.UNKNOWN ||
      r.cost_classification === CostClassification.UNMETERED ||
      r.cost_classification === null,
  ).length;

  // Total known provider cost — only sum METERED rows with non-null cost
  const meteredRows = rows.filter(
    (r) =>
      r.cost_classification === CostClassification.METERED &&
      r.provider_cost !== null &&
      r.provider_cost !== undefined,
  );
  const totalKnownProviderCost =
    meteredRows.length > 0
      ? meteredRows.reduce((sum, r) => sum + (r.provider_cost ?? 0), 0)
      : null;

  // Average cost per known job
  const averageKnownCostPerJob =
    knownCostJobs > 0 && totalKnownProviderCost !== null
      ? Math.round((totalKnownProviderCost / knownCostJobs) * 100) / 100
      : null;

  // Revenue attribution — sum only non-null values
  const revenueRows = rows.filter(
    (r) => r.revenue_attribution !== null && r.revenue_attribution !== undefined,
  );
  const revenueAttributed =
    revenueRows.length > 0
      ? revenueRows.reduce((sum, r) => sum + (r.revenue_attribution ?? 0), 0)
      : null;

  // Gross margin — only when computable from aggregated data
  // Requires both totalKnownProviderCost and revenueAttributed to be non-null
  // and revenueAttributed > 0
  let knownGrossMarginPercent: number | null = null;
  if (
    totalKnownProviderCost !== null &&
    revenueAttributed !== null &&
    revenueAttributed > 0
  ) {
    knownGrossMarginPercent =
      Math.round(((revenueAttributed - totalKnownProviderCost) / revenueAttributed) * 100 * 100) / 100;
  }

  // Data confidence based on proportion of known-cost jobs
  const knownRatio = knownCostJobs / totalJobs;
  let dataConfidence: ProviderEconomicMetrics['dataConfidence'];
  if (totalJobs >= 50 && knownRatio >= 0.8) {
    dataConfidence = 'HIGH';
  } else if (totalJobs >= 20 && knownRatio >= 0.5) {
    dataConfidence = 'MEDIUM';
  } else {
    dataConfidence = 'LOW';
  }

  return {
    provider,
    totalJobs,
    successfulJobs,
    failedJobs,
    knownCostJobs,
    unknownCostJobs,
    totalKnownProviderCost,
    averageKnownCostPerJob,
    revenueAttributed,
    knownGrossMarginPercent,
    dataConfidence,
  };
}
