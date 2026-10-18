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
import {
  buildEmptyEconomicMetrics,
  computeDataConfidence,
  type MediaJobEconomicRow,
  type ProviderEconomicMetrics,
} from './media-job-economics-types';

export type { MediaJobEconomicRow, ProviderEconomicMetrics } from './media-job-economics-types';

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
    return buildEmptyEconomicMetrics(provider);
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
  let knownGrossMarginPercent: number | null = null;
  if (
    totalKnownProviderCost !== null &&
    revenueAttributed !== null &&
    revenueAttributed > 0
  ) {
    knownGrossMarginPercent =
      Math.round(((revenueAttributed - totalKnownProviderCost) / revenueAttributed) * 100 * 100) / 100;
  }

  const dataConfidence = computeDataConfidence(totalJobs, knownCostJobs);
  const attributionProvenanceCount = revenueRows.length;

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
    attributionProvenanceCount,
    dataConfidence,
  };
}
