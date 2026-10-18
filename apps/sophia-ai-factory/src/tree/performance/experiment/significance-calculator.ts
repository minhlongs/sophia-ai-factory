/**
 * Statistical Significance & Result Mappers for Experiments
 *
 * @module tree/performance/experiment/significance-calculator
 */

import { getD1 } from '@/seed/db/client';
import { PerformanceError } from '../errors';
import type { ExperimentResult, ResultRow } from './types';
import {
  resultRowToDomain,
  calculateZScoreSignificance,
  type SignificanceResult,
} from './significance-math';

export {
  resultRowToDomain,
  calculateZScoreSignificance,
  type SignificanceResult,
};

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
