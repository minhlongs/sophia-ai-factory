/**
 * Two-Proportion Z-Score Statistical Significance Math & Result Row Mapper
 *
 * @module tree/performance/experiment/significance-math
 */

import type { ExperimentResult, ResultRow } from './types';

export interface SignificanceResult {
  pValue: number;
  zScore: number;
  significant: boolean;
  confidence: number;
}

/**
 * Maps database ResultRow to domain ExperimentResult.
 */
export function resultRowToDomain(row: ResultRow): ExperimentResult {
  let parsedMetadata: Record<string, unknown> = {};
  if (row.metadata) {
    try {
      parsedMetadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      // Corrupt metadata — preserve raw string for debugging but don't crash
      parsedMetadata = { _corrupt: true, _raw: row.metadata };
    }
  }
  return {
    id: row.id,
    experimentId: row.experiment_id,
    variantId: row.variant_id,
    sampleSize: row.sample_size,
    conversions: row.conversions,
    conversionRate: row.conversion_rate,
    revenueCents: row.revenue_cents,
    metadata: parsedMetadata,
    recordedAt: row.recorded_at,
  };
}

function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

/**
 * Calculates two-proportion Z-test statistical significance between control and treatment.
 */
export function calculateZScoreSignificance(
  controlConversions: number,
  controlSampleSize: number,
  treatmentConversions: number,
  treatmentSampleSize: number,
): SignificanceResult {
  if (controlSampleSize <= 0 || treatmentSampleSize <= 0) {
    return { pValue: 1, zScore: 0, significant: false, confidence: 0 };
  }

  const p1 = controlConversions / controlSampleSize;
  const p2 = treatmentConversions / treatmentSampleSize;
  const pooled = (controlConversions + treatmentConversions) / (controlSampleSize + treatmentSampleSize);

  const se = Math.sqrt(pooled * (1 - pooled) * (1 / controlSampleSize + 1 / treatmentSampleSize));
  if (se === 0) {
    return { pValue: 1, zScore: 0, significant: false, confidence: 0 };
  }

  const zScore = (p2 - p1) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));
  const confidence = Math.max(0, Math.min(1, 1 - pValue));

  return {
    pValue: Number(pValue.toFixed(4)),
    zScore: Number(zScore.toFixed(4)),
    significant: pValue < 0.05,
    confidence: Number((confidence * 100).toFixed(2)),
  };
}
