/**
 * Optimistic Concurrency Control (OCC) CAS: Single Pattern Update Engine.
 * Layer: tree (domain reusable)
 *
 * @module tree/learning-loop/cas/pattern-pipeline-helpers
 */

import type { PatternUpdateDetail } from '@/seed/types/creative-intelligence';
import type { PlaybookPatternCandidateRow } from './pattern-dimension-resolver';
import {
  applyRefreshedRow,
  computeUpdatedAverages,
  refreshPatternAfterCollision,
} from './pattern-cas-refresh';

export {
  computeUpdatedAverages,
  refreshPatternAfterCollision,
  applyRefreshedRow,
};

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
