/**
 * Monthly mission-create quota by tier.
 *
 * Defense-in-depth gate to prevent a BASIC tenant from exhausting platform
 * compute by spamming /api/raas/missions or /api/missions/auto-video.
 *
 * Counts rows in `missions` (raas) or `engine_missions` (auto-video) created
 * in the current calendar month for the requesting user.
 *
 * Uses count-only queries to avoid introducing a new usage table — keeps
 * the surface YAGNI and works against the existing schema.
 */

import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const MISSION_QUOTA_BY_TIER: Record<string, number> = {
  BASIC: 10,
  PREMIUM: 100,
  ENTERPRISE: 1000,
  MASTER: 10000,
};

export interface MissionQuotaCheck {
  allowed: boolean;
  used: number;
  limit: number;
  resetAt: string;
}

function startOfMonthUtcMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

function nextMonthResetAtIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

/**
 * Check whether the user has remaining mission slots this month.
 *
 * `table` selects which table to count:
 *  - 'missions'        → /api/raas/missions (uses org_id column for owner)
 *  - 'engine_missions' → /api/missions/auto-video (uses user_id column)
 *
 * Returns `allowed=true` on count-failure (fail-open) so a transient D1 issue
 * doesn't block paying customers — the upstream BYOK / payment layers remain
 * the hard gate against abuse. Anomalies are surfaced via the logger by the
 * D1 layer itself.
 */
export async function checkMissionQuota(
  userId: string,
  tier: string,
  table: 'missions' | 'engine_missions',
): Promise<MissionQuotaCheck> {
  const limit = MISSION_QUOTA_BY_TIER[tier] ?? MISSION_QUOTA_BY_TIER.BASIC;
  const sinceMs = startOfMonthUtcMs();
  const resetAt = nextMonthResetAtIso();

  // missions.created_at  → TEXT 'YYYY-MM-DD HH:MM:SS' (use datetime() cast)
  // engine_missions.created_at → INTEGER unix seconds (bind integer)
  const ownerCol = table === 'missions' ? 'org_id' : 'user_id';

  try {
    const d1 = await getD1Raw();
    let row: { c: number } | null;
    if (table === 'missions') {
      const sinceText = new Date(sinceMs).toISOString().replace('T', ' ').slice(0, 19);
      const sql = `SELECT COUNT(*) AS c FROM missions WHERE ${ownerCol} = ?1 AND datetime(created_at) >= datetime(?2)`;
      row = await d1.prepare(sql).bind(userId, sinceText).first<{ c: number }>();
    } else {
      const sinceSec = Math.floor(sinceMs / 1000);
      const sql = `SELECT COUNT(*) AS c FROM engine_missions WHERE ${ownerCol} = ?1 AND created_at >= ?2`;
      row = await d1.prepare(sql).bind(userId, sinceSec).first<{ c: number }>();
    }
    const used = row?.c ?? 0;
    return { allowed: used < limit, used, limit, resetAt };
  } catch (err) {
    logger.warn('[mission-quota] D1 count failed (fail-open)', {
      table,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { allowed: true, used: 0, limit, resetAt };
  }
}
