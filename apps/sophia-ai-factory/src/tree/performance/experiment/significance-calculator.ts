/**
 * Statistical Significance & Result Mappers for Experiments
 *
 * @module tree/performance/experiment/significance-calculator
 */

import { getD1 } from '@/seed/db/client';
import { PerformanceError } from '../errors';
import type { ExperimentResult, ResultRow } from './types';

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

export interface SignificanceResult {
  pValue: number;
  zScore: number;
  significant: boolean;
  confidence: number;
}

/**
 * Calculates two-proportion Z-test statistical significance between control and treatment.
 */
export function calculateZScoreSignificance(
  controlConversions: number,
  controlSampleSize: number,
  treatmentConversions: number,
  treatmentSampleSize: number
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

function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

export async function recordExperimentResult(
  experimentId: string,
  variantId: string,
  result: Omit<ExperimentResult, 'id' | 'experimentId' | 'variantId' | 'recordedAt'>,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const id = 'eres_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const now = Math.floor(Date.now() / 1000);

  try {
    await db
      .prepare(
        `INSERT INTO experiment_results
           (id, experiment_id, variant_id, sample_size, conversions,
            conversion_rate, revenue_cents, metadata, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, experimentId, variantId,
        result.sampleSize, result.conversions, result.conversionRate,
        result.revenueCents,
        JSON.stringify(result.metadata),
        now,
      )
      .run();
  } catch (err) {
    throw new PerformanceError(
      'INSERT_FAILED',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}

export async function getExperimentResults(
  experimentId: string,
): Promise<ExperimentResult[]> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(
      `SELECT er.*, v.name AS variant_name
       FROM experiment_results er
       LEFT JOIN experiment_variants v ON er.variant_id = v.id
       WHERE er.experiment_id = ?1
       ORDER BY er.recorded_at DESC`,
    )
    .bind(experimentId)
    .all<ResultRow & { variant_name: string | null }>();

  return (result.results ?? []).map(resultRowToDomain);
}
