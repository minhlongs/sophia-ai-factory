/**
 * Checkpoint and Optimistic Concurrency Control (OCC CAS) state transitions.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/checkpoint-cas
 */

import { getD1 } from '@/seed/db/client';
import type { CreativeMissionStatus } from '@/seed/types/creative-economy';
import {
  setCachedTrackStatus,
  clearTrackStatusCache,
  type MissionTrackStatus,
} from '@/tree/mission';
import { MissionError } from '@/tree/mission/types';

export { assertMissionActive, transitionStatusCAS } from './mission-status-guards';

/**
 * Persist live track status in memory and to creative_missions.constraints.track_status.
 * Guarded with allowedStatuses (default: ['running']) to ensure non-running missions
 * (e.g. failed, cancelled, completed) are NEVER mutated by lagging background sub-tracks.
 */
export async function saveCheckpoint(
  missionId: string,
  trackStatus: MissionTrackStatus,
  currentPhase: string,
  allowedStatuses: CreativeMissionStatus[] = ['running'],
): Promise<void> {
  const db = await getD1();
  if (!db) {
    if (!['failed', 'review', 'completed', 'cancelled'].includes(currentPhase)) {
      setCachedTrackStatus(missionId, trackStatus);
    }
    return;
  }

  const row = await db
    .prepare('SELECT status, constraints FROM creative_missions WHERE id = ?')
    .bind(missionId)
    .first<{ status: CreativeMissionStatus; constraints: string }>();

  if (!row) {
    throw new MissionError('NOT_FOUND', `Mission ${missionId} not found`);
  }

  // Fail-closed guard: reject update if mission status is not allowed
  if (!allowedStatuses.includes(row.status)) {
    throw new MissionError(
      'CONCURRENT_MODIFICATION',
      `Cannot save checkpoint for mission ${missionId}: status is '${row.status}', expected 'running'`
    );
  }

  let constraintsObj: Record<string, unknown> = {};
  if (row.constraints) {
    try {
      constraintsObj = JSON.parse(row.constraints) as Record<string, unknown>;
    } catch {
      constraintsObj = {};
    }
  }

  constraintsObj.track_status = trackStatus;
  const now = Math.floor(Date.now() / 1000);

  const placeholders = allowedStatuses.map(() => '?').join(', ');
  const result = await db
    .prepare(
      `UPDATE creative_missions
       SET constraints = ?, current_phase = ?, updated_at = ?
       WHERE id = ? AND status IN (${placeholders})`
    )
    .bind(JSON.stringify(constraintsObj), currentPhase, now, missionId, ...allowedStatuses)
    .run();

  if (result.meta.changes === 0) {
    throw new MissionError(
      'CONCURRENT_MODIFICATION',
      `Mission ${missionId} status changed concurrently while saving checkpoint`
    );
  }

  if (row.status === 'running') {
    setCachedTrackStatus(missionId, trackStatus);
  } else {
    clearTrackStatusCache(missionId);
  }
}
