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

// ── In-Memory Live Track State Cache with TTL & Capacity Bounds ─────────────

interface CachedTrackEntry {
  status: MissionTrackStatus;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL
const MAX_CACHE_ENTRIES = 500;
const liveTrackStatusMap = new Map<string, CachedTrackEntry>();

export function getCachedTrackStatus(missionId: string): MissionTrackStatus | undefined {
  const entry = liveTrackStatusMap.get(missionId);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    liveTrackStatusMap.delete(missionId);
    return undefined;
  }
  return { ...entry.status };
}

export function setCachedTrackStatus(
  missionId: string,
  status: MissionTrackStatus,
  ttlMs: number = CACHE_TTL_MS,
): void {
  // Prune expired or overflow entries if capacity reached
  if (liveTrackStatusMap.size >= MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [id, item] of liveTrackStatusMap) {
      if (now > item.expiresAt) {
        liveTrackStatusMap.delete(id);
      }
    }
    if (liveTrackStatusMap.size >= MAX_CACHE_ENTRIES) {
      const oldestKeys = Array.from(liveTrackStatusMap.keys()).slice(0, 50);
      for (const k of oldestKeys) liveTrackStatusMap.delete(k);
    }
  }

  liveTrackStatusMap.set(missionId, {
    status: { ...status },
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearTrackStatusCache(missionId?: string): void {
  if (missionId) {
    liveTrackStatusMap.delete(missionId);
  } else {
    liveTrackStatusMap.clear();
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

  if (preloadedConstraints) {
    try {
      const parsed = JSON.parse(preloadedConstraints) as { track_status?: MissionTrackStatus };
      if (parsed.track_status) {
        return { ...parsed.track_status };
      }
    } catch {
      // Fall through to DB query
    }
  }

  const db = await getD1();
  if (db) {
    try {
      const row = await db
        .prepare('SELECT status, current_phase, constraints FROM creative_missions WHERE id = ?')
        .bind(missionId)
        .first<{ status: string; current_phase: string; constraints: string }>();

      if (row?.constraints) {
        try {
          const parsed = JSON.parse(row.constraints) as { track_status?: MissionTrackStatus };
          if (parsed.track_status) {
            if (row.status === 'running') {
              setCachedTrackStatus(missionId, parsed.track_status);
            }
            return { ...parsed.track_status };
          }
        } catch {
          // Fall back to phase inference below
        }
      }

      if (row) {
        if (row.status === 'review' || row.status === 'completed') {
          return { script: 'completed', audio: 'completed', visual: 'completed', video: 'completed' };
        }
        if (row.status === 'failed' || row.status === 'cancelled') {
          return { script: 'failed', audio: 'failed', visual: 'failed', video: 'failed' };
        }
        if (row.current_phase === 'video_compositing' || row.current_phase === 'composited') {
          return { script: 'completed', audio: 'completed', visual: 'completed', video: 'running' };
        }
        if (row.current_phase === 'voice_and_visuals') {
          return { script: 'completed', audio: 'running', visual: 'running', video: 'pending' };
        }
        if (row.current_phase === 'script_generation') {
          return { script: 'running', audio: 'pending', visual: 'pending', video: 'pending' };
        }
      }
    } catch {
      // Return default pending
    }
  }

  return {
    script: 'pending',
    audio: 'pending',
    visual: 'pending',
    video: 'pending',
  };
}
