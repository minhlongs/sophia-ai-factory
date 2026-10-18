/**
 * In-Memory Live Mission Track State Cache with TTL & Capacity Bounds
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/mission/track-status-cache
 */

import type { MissionTrackStatus } from './types';

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
