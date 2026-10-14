/**
 * Row types, confidence classification, and per-provider aggregation helper
 * for /api/v1/creative-studio/economics.
 * @module app/api/v1/creative-studio/economics/economics-route-helpers
 */

import { computeProviderMetrics } from '@/tree/media-jobs/media-job-economics-query';
import { aggregateEconomicMetrics } from '@/tree/media-jobs/media-job-economics-aggregate';
import { assessProviderHealth } from '@/tree/media-jobs/provider-health-policy';

export interface MediaJobRow {
  provider: string;
  status: string;
  latency_ms: number | null;
  retry_count: number | null;
  provider_cost: number | null;
  cost_classification: string | null;
  revenue_attribution: number | null;
  gross_margin: number | null;
}

export interface ProvenanceRow {
  provider: string;
  count: number;
  freshest: number | null;
}

export interface ProviderResponse {
  provider: string;
  health: ReturnType<typeof assessProviderHealth>;
  reliability: ReturnType<typeof computeProviderMetrics>;
  economics: ReturnType<typeof aggregateEconomicMetrics>;
  attributionConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  provenanceCount: number;
  dataFreshest: number | null;
  grossMarginPercent: number | null;
}

export function classifyAttributionConfidence(
  provenanced: number,
  total: number,
): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (total === 0) return 'LOW';
  const ratio = provenanced / total;
  if (ratio >= 0.8) return 'HIGH';
  if (ratio >= 0.5) return 'MEDIUM';
  return 'LOW';
}

export function buildProviderEconomicsResponses(
  rows: MediaJobRow[],
  provRows: ProvenanceRow[],
): ProviderResponse[] {
  const byProvider = new Map<string, MediaJobRow[]>();
  for (const row of rows) {
    const key = row.provider ?? 'unknown';
    const existing = byProvider.get(key);
    if (existing) {
      existing.push(row);
    } else {
      byProvider.set(key, [row]);
    }
  }

  const provByProvider = new Map<string, ProvenanceRow>();
  for (const r of provRows) {
    provByProvider.set(r.provider ?? 'unknown', r);
  }

  const providers: ProviderResponse[] = [];
  for (const [provider, providerRows] of byProvider) {
    const reliabilityRows = providerRows.map((r) => ({
      status: r.status,
      latency_ms: r.latency_ms,
      retry_count: r.retry_count,
    }));

    const economicRows = providerRows.map((r) => ({
      status: r.status,
      provider_cost: r.provider_cost,
      cost_classification: r.cost_classification,
      revenue_attribution: r.revenue_attribution,
      gross_margin: r.gross_margin,
    }));

    const windowSeconds = 86400 * 30;
    const reliability = computeProviderMetrics(reliabilityRows, windowSeconds, provider);
    const economics = aggregateEconomicMetrics(economicRows, provider);
    const health = assessProviderHealth(reliability);

    const prov = provByProvider.get(provider);
    const provenanced = prov?.count ?? 0;
    const freshest = prov?.freshest ?? null;
    const completed = providerRows.filter((r) => r.status === 'completed').length;
    const attributionConfidence = classifyAttributionConfidence(provenanced, completed);

    providers.push({
      provider,
      health,
      reliability,
      economics,
      attributionConfidence,
      provenanceCount: provenanced,
      dataFreshest: freshest,
      grossMarginPercent: economics.knownGrossMarginPercent,
    });
  }

  return providers;
}
