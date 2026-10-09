/**
 * Optimistic Concurrency Control (OCC) CAS: Single Pattern Update Engine.
 * Layer: tree (domain reusable)
 *
 * @module tree/learning-loop/cas/pattern-pipeline-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import type { PatternUpdateDetail } from '@/seed/types/creative-intelligence';
import {
  computeLogarithmicConfidence,
  determineConfidenceLevel,
} from '../effectiveness-scorer';
import type { PlaybookPatternCandidateRow } from './pattern-dimension-resolver';

export function computeUpdatedAverages(
  currentAvg: number,
  currentN: number,
  cesScore: number,
): {
  newN: number;
  safeNewAvg: number;
  newConfidence: number;
  newConfidenceLevel: 'high' | 'medium' | 'low';
} {
  const newN = currentN + 1;
  let newAvg: number;
  if (currentN < 10) {
    newAvg = (currentAvg * currentN + cesScore) / newN;
  } else {
    newAvg = 0.4 * cesScore + 0.6 * currentAvg;
  }
  if (!Number.isFinite(newAvg)) {
    newAvg = cesScore;
  }
  const safeNewAvg = Math.round(Math.min(100, Math.max(0, newAvg)) * 100) / 100;
  const newConfidence = computeLogarithmicConfidence(newN);
  const newConfidenceLevel = determineConfidenceLevel(newConfidence);

  return { newN, safeNewAvg, newConfidence, newConfidenceLevel };
}

export async function refreshPatternAfterCollision(
  db: D1Database,
  patternId: string,
  attempt: number,
): Promise<{ nextN?: number; nextAvg?: number; nextDetectedAt?: number } | null> {
  const baseJitter = 25 * Math.pow(2, attempt) + 10;
  const jitterMs = Math.floor(Math.random() * Math.min(500, baseJitter));
  await new Promise((resolve) => setTimeout(resolve, jitterMs));

  const latestRow = await db
    .prepare(
      `SELECT avg_metric, sample_size, detected_at
       FROM playbook_patterns
       WHERE id = ?`,
    )
    .bind(patternId)
    .first<{ avg_metric?: number; sample_size?: number; detected_at: number }>();

  if (!latestRow) {
    logger.warn('[ScoringCAS] Pattern row deleted during OCC CAS retry', {
      patternId,
    });
    return null;
  }

  const nextN =
    typeof latestRow.sample_size === 'number' && Number.isFinite(latestRow.sample_size)
      ? latestRow.sample_size
      : undefined;
  const nextAvg =
    typeof latestRow.avg_metric === 'number' && Number.isFinite(latestRow.avg_metric)
      ? latestRow.avg_metric
      : undefined;

  return { nextN, nextAvg, nextDetectedAt: latestRow.detected_at };
}

export function applyRefreshedRow(
  state: { currentN: number; currentAvg: number; currentDetectedAt: number },
  refreshed: { nextN?: number; nextAvg?: number; nextDetectedAt?: number },
): void {
  if (refreshed.nextN !== undefined) state.currentN = refreshed.nextN;
  if (refreshed.nextAvg !== undefined) state.currentAvg = refreshed.nextAvg;
  if (refreshed.nextDetectedAt !== undefined) state.currentDetectedAt = refreshed.nextDetectedAt;
}

export async function executePatternDbUpdate(
  db: D1Database,
  patternId: string,
  currentDetectedAt: number,
  avgData: ReturnType<typeof computeUpdatedAverages>,
): Promise<boolean> {
  const nowTimestamp = Math.max(Date.now(), currentDetectedAt + 1);
  const result = await db
    .prepare(
      `UPDATE playbook_patterns
       SET avg_metric = ?,
           sample_size = ?,
           confidence = ?,
           confidence_level = ?,
           detected_at = ?
       WHERE id = ? AND detected_at = ?`,
    )
    .bind(
      avgData.safeNewAvg,
      avgData.newN,
      avgData.newConfidence,
      avgData.newConfidenceLevel,
      nowTimestamp,
      patternId,
      currentDetectedAt,
    )
    .run();
  return result.meta.changes > 0;
}

export async function updateSinglePatternCAS(
  db: D1Database,
  pattern: PlaybookPatternCandidateRow,
  cesScore: number,
  maxRetries: number,
): Promise<PatternUpdateDetail> {
  const state = {
    currentAvg: Number.isFinite(pattern.avg_metric) ? pattern.avg_metric : cesScore,
    currentN:
      Number.isFinite(pattern.sample_size) && pattern.sample_size >= 0
        ? pattern.sample_size
        : 0,
    currentDetectedAt: pattern.detected_at,
  };
  let success = false;
  let attemptsTaken = 0;
  let finalNewAvg = state.currentAvg;
  let finalNewN = state.currentN;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attemptsTaken = attempt;
    const avgData = computeUpdatedAverages(state.currentAvg, state.currentN, cesScore);
    finalNewAvg = avgData.safeNewAvg;
    finalNewN = avgData.newN;

    const updated = await executePatternDbUpdate(
      db,
      pattern.id,
      state.currentDetectedAt,
      avgData,
    );
    if (updated) {
      success = true;
      break;
    }

    if (attempt >= maxRetries) break;

    const refreshed = await refreshPatternAfterCollision(db, pattern.id, attempt);
    if (!refreshed) break;
    applyRefreshedRow(state, refreshed);
  }

  return {
    patternId: pattern.id,
    featureKey: pattern.feature_key,
    featureValue: pattern.feature_value,
    previousAvg: pattern.avg_metric,
    newAvg: finalNewAvg,
    sampleSize: finalNewN,
    retries: attemptsTaken,
    status: success ? 'updated' : 'conflict_exhausted',
  };
}
