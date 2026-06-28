/**
 * Monthly mission-create quota by tier.
 *
 * Defense-in-depth gate to prevent a BASIC tenant from exhausting platform
 * compute by spamming /api/raas/missions or /api/missions/auto-video.
 *
 * Counts rows in BOTH `missions` (RaaS org scope) and `engine_missions`
 * (auto-video user scope) created in the current calendar month.
 *
 * Uses count-only queries to avoid introducing a new usage table — keeps
 * the surface YAGNI and works against the existing schema.
 */

import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { resolveOrgId, resolveOrgOwnerUserId } from '@/seed/auth/resolve-org-id';

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
 * Check whether the owner has remaining mission slots this month.
 *
 * Sums the counts from BOTH the `missions` and `engine_missions` tables
 * to enforce the tier limit on total combined activity.
 *
 * Returns `allowed=true` on count-failure (fail-open) so a transient D1 issue
 * doesn't block paying customers — the upstream BYOK / payment layers remain
 * the hard gate against abuse. Anomalies are surfaced via the logger by the
 * D1 layer itself.
 */
export async function checkMissionQuota(
  ownerId: string,
  tier: string,
  table: 'missions' | 'engine_missions',
): Promise<MissionQuotaCheck> {
  const limit = MISSION_QUOTA_BY_TIER[tier] ?? MISSION_QUOTA_BY_TIER.BASIC;
  const sinceMs = startOfMonthUtcMs();
  const resetAt = nextMonthResetAtIso();

  try {
    const d1 = await getD1Raw();
    if (!d1) {
      return { allowed: true, used: 0, limit, resetAt };
    }

    let orgId = '';
    let userId = '';

    if (table === 'missions') {
      orgId = ownerId;
      userId = (await resolveOrgOwnerUserId(orgId, d1)) ?? orgId;
    } else {
      userId = ownerId;
      orgId = (await resolveOrgId(userId, d1)) ?? userId;
    }

    const sinceText = new Date(sinceMs).toISOString().replace('T', ' ').slice(0, 19);
    const sinceSec = Math.floor(sinceMs / 1000);

    const missionsSql = `SELECT COUNT(*) AS c FROM missions WHERE org_id = ?1 AND datetime(created_at) >= datetime(?2)`;
    const engineMissionsSql = `SELECT COUNT(*) AS c FROM engine_missions WHERE user_id = ?1 AND created_at >= ?2`;

    const [missionsResult, engineMissionsResult] = await Promise.all([
      d1.prepare(missionsSql).bind(orgId, sinceText).first<{ c: number }>(),
      d1.prepare(engineMissionsSql).bind(userId, sinceSec).first<{ c: number }>(),
    ]);

    const used = (missionsResult?.c ?? 0) + (engineMissionsResult?.c ?? 0);
    return { allowed: used < limit, used, limit, resetAt };
  } catch (err) {
    logger.warn('[mission-quota] D1 count failed (fail-open)', {
      table,
      ownerId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { allowed: true, used: 0, limit, resetAt };
  }
}
