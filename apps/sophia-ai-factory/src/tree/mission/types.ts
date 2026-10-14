/**
 * Mission Lifecycle
 * Layer: tree (domain-specific reusable)
 *
 * Sophia's top-level orchestration object.
 * Mission = "Build media business around sustainable living in SEA."
 *
 * @module tree/mission
 */

import { getD1 } from '@/seed/db/client';
import type { Mission } from '@/seed/types/creative-economy';
import { getMission } from './repository';
import { canStartExecution, EXECUTION_START_FROM } from './transition-rules';

export class MissionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'MissionError';
    this.code = code;
  }
}

export function newMissionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'msn_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export * from './transition-rules';
export * from './multi-track-types';

/**
 * Atomically flip a mission into execution ('running', phase 'executing').
 */
export async function beginMissionExecution(id: string): Promise<Mission> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  const mission = await getMission(id);
  if (!mission) throw new MissionError('NOT_FOUND', `Mission ${id} not found`);
  if (!canStartExecution(mission.status)) {
    throw new MissionError(
      'EXECUTION_START_INVALID',
      `${mission.status} → running not allowed; execution starts from ${EXECUTION_START_FROM.join('/')}`,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      `UPDATE creative_missions SET status = 'running', current_phase = 'executing', updated_at = ? WHERE id = ? AND status = ?`,
    )
    .bind(now, id, mission.status)
    .run();
  if (result.meta.changes === 0) {
    throw new MissionError('CONCURRENT_MODIFICATION', `Mission ${id} status changed concurrently`);
  }
  const updated = await getMission(id);
  if (!updated) throw new MissionError('UPDATE_FAILED', 'Fetch after update failed');
  return updated;
}

export {
  createMission,
  getMission,
  getMissionWithGoals,
  listMissions,
  updateMissionStatus,
  recordSpend,
  deleteMission,
} from './repository';

export { getMissionMetrics } from './metrics';
export type { MissionMetrics } from './metrics';
