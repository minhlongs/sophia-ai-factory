/**
 * Optimistic Concurrency Control (OCC) CAS: Mission Lifecycle Transitions.
 * Layer: tree (domain reusable)
 *
 * @module tree/learning-loop/cas/lifecycle-transitions
 */

import { getD1 } from '@/seed/db/client';
import type { CreativeMissionStatus } from '../types';

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
export const ALLOWED_LIFECYCLE_TRANSITIONS: Record<
  CreativeMissionStatus,
  readonly CreativeMissionStatus[]
> = {
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
export function canMissionTransition(
  from: CreativeMissionStatus,
  to: CreativeMissionStatus,
): boolean {
  const allowed = ALLOWED_LIFECYCLE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
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
