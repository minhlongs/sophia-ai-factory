/**
 * Optimistic Concurrency Control (OCC) CAS: Average Math & Collision Refresh.
 * Layer: tree (domain reusable)
 *
 * @module tree/learning-loop/cas/pattern-cas-refresh
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  computeLogarithmicConfidence,
  determineConfidenceLevel,
} from '../effectiveness-scorer';

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
