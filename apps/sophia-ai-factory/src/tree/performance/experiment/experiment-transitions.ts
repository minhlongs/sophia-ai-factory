/**
 * Experiment State Transition Operations (start & complete)
 *
 * @module tree/performance/experiment/experiment-transitions
 */

import { getD1 } from '@/seed/db/client';
import type { Experiment } from '@/seed/types/creative-domain';
import { PerformanceError } from '../errors';
import type { ExperimentRow } from './types';
import {
  coerceStatus,
  isValidTransition,
} from './variant-allocator';
import { getExperiment } from './experiment-queries';

export async function startExperiment(id: string): Promise<Experiment> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const existing = await db
    .prepare('SELECT * FROM experiments WHERE id = ?1')
    .bind(id)
    .first<ExperimentRow>();

  if (!existing) throw new PerformanceError('NOT_FOUND', `Experiment ${id} not found`);
  const coercedStatus = coerceStatus(existing.status);
  if (!isValidTransition(coercedStatus, 'running')) {
    throw new PerformanceError(
      'INVALID_TRANSITION',
      `Cannot transition ${coercedStatus} → running`,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE experiments SET status = 'running', started_at = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(now, now, id)
    .run();

  return getExperiment(id);
}

export async function completeExperiment(
  id: string,
  opts?: { winnerVariantId?: string; confidence?: number; result?: string },
): Promise<Experiment> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const existing = await db
    .prepare('SELECT * FROM experiments WHERE id = ?1')
    .bind(id)
    .first<ExperimentRow>();

  if (!existing) throw new PerformanceError('NOT_FOUND', `Experiment ${id} not found`);
  const coercedStatus = coerceStatus(existing.status);
  if (!isValidTransition(coercedStatus, 'completed')) {
    throw new PerformanceError(
      'INVALID_TRANSITION',
      `Cannot transition ${coercedStatus} → completed`,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE experiments
       SET status = 'completed', ended_at = ?,
           winner_variant_id = ?, confidence = ?, result = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      now,
      opts?.winnerVariantId ?? null,
      opts?.confidence ?? null,
      opts?.result ?? null,
      now,
      id,
    )
    .run();

  return getExperiment(id);
}
