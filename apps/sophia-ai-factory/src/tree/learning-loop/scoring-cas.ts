/**
 * Optimistic Concurrency Control (OCC) CAS Engine — Phase 5: Auto-Creative Playbook
 *
 * Atomic Compare-And-Swap (CAS) state updates on `playbook_patterns` and
 * mission lifecycle transitions (`completed` -> `learning` -> `iterating`).
 *
 * Layer: tree (domain reusable — only imports from @/seed)
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CASUpdateResult,
  CreativeMissionStatus,
  PatternScoreUpdates,
} from './types';

/** Error thrown on lifecycle or concurrency validation failures */
export class LearningLoopError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'LearningLoopError';
    this.code = code;
  }
}

/** Canonical mission lifecycle transitions */
export const ALLOWED_LIFECYCLE_TRANSITIONS: Record<CreativeMissionStatus, readonly CreativeMissionStatus[]> = {
  draft: ['planned', 'cancelled'],
  planned: ['approval_required', 'cancelled'],
  approval_required: ['running', 'cancelled'],
  running: ['paused', 'review', 'completed', 'failed', 'cancelled'],
  paused: ['running', 'review', 'failed', 'cancelled'],
  review: ['completed', 'iterating', 'failed', 'cancelled'],
  completed: ['learning'],
  learning: ['iterating'],
  iterating: ['draft', 'planned', 'running', 'cancelled'],
  failed: ['draft', 'planned', 'running'],
  cancelled: ['draft'],
};

/**
 * Validate whether a mission status transition is legally permitted.
 */
export function canMissionTransition(from: CreativeMissionStatus, to: CreativeMissionStatus): boolean {
  const allowed = ALLOWED_LIFECYCLE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Perform an atomic OCC Compare-And-Swap update on a playbook pattern score.
 * Verifies that the row's `detected_at` matches `expectedDetectedAt` before applying updates.
 *
 * @param patternId           ID of the playbook_pattern record
 * @param expectedDetectedAt Expected timestamp before update
 * @param updates             New metric, sample, and confidence values
 * @param maxRetries          Maximum retry attempts on concurrent collision (default 3)
 * @param d1Override          Optional D1 binding for testing
 */
export async function updatePatternScoreCAS(
  patternId: string,
  expectedDetectedAt: number,
  updates: PatternScoreUpdates,
  maxRetries = 3,
  d1Override?: D1Database,
): Promise<CASUpdateResult> {
  const db = d1Override !== undefined ? d1Override : await getD1();
  if (!db) {
    return { success: false, changes: 0, retries: 0, error: 'D1_UNAVAILABLE' };
  }

  let currentExpected = expectedDetectedAt;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const now = Date.now();

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
        updates.avgMetric,
        updates.sampleSize,
        updates.confidence,
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
      const refreshed = await db
        .prepare('SELECT detected_at FROM playbook_patterns WHERE id = ?')
        .bind(patternId)
        .first<{ detected_at: number }>();

      if (!refreshed) {
        return {
          success: false,
          changes: 0,
          retries: attempt,
          error: 'PATTERN_NOT_FOUND',
        };
      }

      currentExpected = refreshed.detected_at;
      // Exponential jitter backoff between retry attempts
      const jitterMs = Math.random() * 20 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, jitterMs));
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

/**
 * Atomically transition a creative mission's lifecycle state via OCC CAS.
 * Asserts that changes > 0; throws `CONCURRENT_MODIFICATION` if row was altered concurrently.
 */
export async function transitionMissionLifecycleCAS(
  missionId: string,
  expectedStatus: CreativeMissionStatus,
  newStatus: CreativeMissionStatus,
  currentPhase = 'learning_loop',
  d1Override?: D1Database,
): Promise<void> {
  if (!canMissionTransition(expectedStatus, newStatus)) {
    throw new LearningLoopError(
      'INVALID_STATUS_TRANSITION',
      `Cannot transition mission ${missionId} from '${expectedStatus}' to '${newStatus}'`,
    );
  }

  const db = d1Override !== undefined ? d1Override : await getD1();
  if (!db) {
    throw new LearningLoopError('D1_UNAVAILABLE', 'D1 database binding unavailable');
  }

  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .prepare(
      `UPDATE creative_missions
       SET status = ?, current_phase = ?, updated_at = ?
       WHERE id = ? AND status = ?`,
    )
    .bind(newStatus, currentPhase, now, missionId, expectedStatus)
    .run();

  if (result.meta.changes === 0) {
    throw new LearningLoopError(
      'CONCURRENT_MODIFICATION',
      `Mission ${missionId} status changed concurrently (expected: ${expectedStatus})`,
    );
  }
}

/**
 * Advance mission lifecycle from completed to learning stage.
 */
export async function transitionMissionToLearningCAS(
  missionId: string,
  d1Override?: D1Database,
): Promise<void> {
  await transitionMissionLifecycleCAS(
    missionId,
    'completed',
    'learning',
    'learning_loop_analyzing',
    d1Override,
  );
}

/**
 * Advance mission lifecycle from learning to iterating stage.
 */
export async function transitionMissionToIteratingCAS(
  missionId: string,
  d1Override?: D1Database,
): Promise<void> {
  await transitionMissionLifecycleCAS(
    missionId,
    'learning',
    'iterating',
    'ready_for_iteration',
    d1Override,
  );
}
