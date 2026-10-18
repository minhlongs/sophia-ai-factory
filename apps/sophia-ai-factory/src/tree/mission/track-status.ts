/**
 * Mission Track Status & Live In-Memory Cache
 * Layer: tree (domain-specific reusable)
 *
 * Provides live caching and database querying of multi-track execution status.
 *
 * @module tree/mission/track-status
 */

import { getD1 } from '@/seed/db/client';
import type { MissionTrackStatus } from './types';
import {
  getCachedTrackStatus,
  setCachedTrackStatus,
  clearTrackStatusCache,
} from './track-status-cache';

export {
  getCachedTrackStatus,
  setCachedTrackStatus,
  clearTrackStatusCache,
};

function parseTrackStatusConstraint(constraints?: string | null): MissionTrackStatus | null {
  if (!constraints) return null;
  try {
    const parsed = JSON.parse(constraints) as { track_status?: MissionTrackStatus };
    return parsed.track_status ?? null;
  } catch {
    return null;
  }
}

function inferTrackStatusFromPhase(status: string, currentPhase: string): MissionTrackStatus | null {
  if (status === 'review' || status === 'completed') {
    return { script: 'completed', audio: 'completed', visual: 'completed', video: 'completed' };
  }
  if (status === 'failed' || status === 'cancelled') {
    return { script: 'failed', audio: 'failed', visual: 'failed', video: 'failed' };
  }
  if (currentPhase === 'video_compositing' || currentPhase === 'composited') {
    return { script: 'completed', audio: 'completed', visual: 'completed', video: 'running' };
  }
  if (currentPhase === 'voice_and_visuals') {
    return { script: 'completed', audio: 'running', visual: 'running', video: 'pending' };
  }
  if (currentPhase === 'script_generation') {
    return { script: 'running', audio: 'pending', visual: 'pending', video: 'pending' };
  }
  return null;
}

async function resolveTrackStatusFromDb(missionId: string): Promise<MissionTrackStatus | null> {
  const db = await getD1();
  if (!db) return null;

  try {
    const row = await db
      .prepare('SELECT status, current_phase, constraints FROM creative_missions WHERE id = ?')
      .bind(missionId)
      .first<{ status: string; current_phase: string; constraints: string }>();

    if (!row) return null;

    const fromConstraints = parseTrackStatusConstraint(row.constraints);
    if (fromConstraints) {
      if (row.status === 'running') {
        setCachedTrackStatus(missionId, fromConstraints);
      }
      return fromConstraints;
    }

    return inferTrackStatusFromPhase(row.status, row.current_phase);
  } catch {
    return null;
  }
}

/**
 * Query live track status for a mission.
 */
export async function getMissionTrackStatus(
  missionId: string,
  preloadedConstraints?: string | null,
): Promise<MissionTrackStatus> {
  const cached = getCachedTrackStatus(missionId);
  if (cached) return { ...cached };

  const fromPreloaded = parseTrackStatusConstraint(preloadedConstraints);
  if (fromPreloaded) return { ...fromPreloaded };

  const fromDb = await resolveTrackStatusFromDb(missionId);
  if (fromDb) return fromDb;

  return {
    script: 'pending',
    audio: 'pending',
    visual: 'pending',
    video: 'pending',
  };
}
