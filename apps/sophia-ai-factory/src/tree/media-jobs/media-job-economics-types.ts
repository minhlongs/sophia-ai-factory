/**
 * @module tree/media-jobs/media-job-economics-types
 *
 * Types and helpers for provider economic metrics aggregation.
 *
 * Layer rule: tree — imports from seed only.
 */

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
  attributionProvenanceCount: number;
  dataConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export function buildEmptyEconomicMetrics(provider: string): ProviderEconomicMetrics {
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
    attributionProvenanceCount: 0,
    dataConfidence: 'LOW',
  };
}

export function computeDataConfidence(
  totalJobs: number,
  knownCostJobs: number,
): ProviderEconomicMetrics['dataConfidence'] {
  if (totalJobs === 0) return 'LOW';
  const knownRatio = knownCostJobs / totalJobs;
  if (totalJobs >= 50 && knownRatio >= 0.8) return 'HIGH';
  if (totalJobs >= 20 && knownRatio >= 0.5) return 'MEDIUM';
  return 'LOW';
}
