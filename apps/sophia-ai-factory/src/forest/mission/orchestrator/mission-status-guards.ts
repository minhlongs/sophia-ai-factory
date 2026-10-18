/**
 * Active mission guard and Optimistic Concurrency Control (OCC CAS) status transition.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/mission-status-guards
 */

import { getD1 } from '@/seed/db/client';
import type { CreativeMissionStatus } from '@/seed/types/creative-economy';
import { MissionError } from '@/tree/mission/types';

/**
 * Assert that the mission exists and is still active ('running').
 * Checks both database status and AbortSignal to halt execution immediately on cancellation.
 */
export async function assertMissionActive(
  missionId: string,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    throw new MissionError('MISSION_CANCELLED', 'Mission execution was aborted');
  }

  const db = await getD1();
  if (!db) return;

  const row = await db
    .prepare('SELECT status FROM creative_missions WHERE id = ?')
    .bind(missionId)
    .first<{ status: string }>();

  if (!row) {
    throw new MissionError('NOT_FOUND', `Mission ${missionId} not found`);
  }

  if (row.status === 'cancelled') {
    throw new MissionError('MISSION_CANCELLED', `Mission ${missionId} has been cancelled`);
  }

  if (row.status !== 'running') {
    throw new MissionError(
      'INVALID_STATE',
      `Mission ${missionId} is no longer running (status: ${row.status})`
    );
  }
}

/**
 * Optimistic Concurrency Control (OCC CAS) state transition.
 * Fails closed with CONCURRENT_MODIFICATION if row was modified concurrently.
 */
export async function transitionStatusCAS(
  missionId: string,
  expectedStatus: CreativeMissionStatus,
  newStatus: CreativeMissionStatus,
  currentPhase: string,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      'UPDATE creative_missions SET status = ?, current_phase = ?, updated_at = ? WHERE id = ? AND status = ?'
    )
    .bind(newStatus, currentPhase, now, missionId, expectedStatus)
    .run();

  if (result.meta.changes === 0) {
    throw new MissionError(
      'CONCURRENT_MODIFICATION',
      `Mission ${missionId} status changed concurrently (expected: ${expectedStatus})`
    );
  }
}
