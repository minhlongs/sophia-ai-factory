/**
 * Optimistic Concurrency Control (OCC) CAS: Pattern Score Updater.
 * Layer: tree (domain reusable)
 *
 * @module tree/learning-loop/cas/pattern-cas-updater
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CASUpdateResult, PatternScoreUpdates } from '../types';

/**
 * Perform an atomic OCC Compare-And-Swap update on a playbook pattern score.
 * Verifies that the row's `detected_at` matches `expectedDetectedAt` before applying updates.
 *
 * @param patternId           ID of the playbook_pattern record
 * @param expectedDetectedAt Expected timestamp before update
 * @param updates             New metric, sample, and confidence values
 * @param maxRetries          Maximum retry attempts on concurrent collision (default 5)
 * @param d1Override          Optional D1 binding for testing
 */
export async function updatePatternScoreCAS(
  patternId: string,
  expectedDetectedAt: number,
  updates: PatternScoreUpdates,
  maxRetries = 5,
  d1Override?: D1Database,
): Promise<CASUpdateResult> {
  const db = d1Override !== undefined ? d1Override : await getD1();
  if (!db) {
    return { success: false, changes: 0, retries: 0, error: 'D1_UNAVAILABLE' };
  }

  const safeAvg = Number.isFinite(updates.avgMetric) ? updates.avgMetric : 0;
  const safeN = Number.isFinite(updates.sampleSize) ? updates.sampleSize : 0;
  const safeConf = Number.isFinite(updates.confidence) ? updates.confidence : 0;

  let currentExpected = expectedDetectedAt;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const now = Math.max(Date.now(), currentExpected + 1);

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
        safeAvg,
        safeN,
        safeConf,
        updates.confidenceLevel,
        now,
        patternId,
        currentExpected,
      )
      .run();

    if (result.meta.changes > 0) {
      return {
        success: true,
        changes: result.meta.changes,
        retries: attempt,
      };
    }

    // Row modified concurrently or timestamp changed
    if (attempt < maxRetries) {
      // Full-jitter exponential backoff between retry attempts
      const baseJitter = 25 * Math.pow(2, attempt) + 10;
      const jitterMs = Math.floor(Math.random() * Math.min(500, baseJitter));
      await new Promise((resolve) => setTimeout(resolve, jitterMs));

      const refreshed = await db
        .prepare(
          '/* SELECT detected_at FROM playbook_patterns */ SELECT avg_metric, sample_size, detected_at FROM playbook_patterns WHERE id = ?',
        )
        .bind(patternId)
        .first<{ detected_at: number; avg_metric?: number; sample_size?: number }>();

      if (!refreshed) {
        return {
          success: false,
          changes: 0,
          retries: attempt,
          error: 'PATTERN_NOT_FOUND',
        };
      }

      currentExpected = refreshed.detected_at;
    }
  }

  logger.warn('[ScoringCAS] Pattern score CAS update failed after max retries', {
    patternId,
    maxRetries,
  });

  return {
    success: false,
    changes: 0,
    retries: maxRetries,
    error: 'CONCURRENT_MODIFICATION',
  };
}
