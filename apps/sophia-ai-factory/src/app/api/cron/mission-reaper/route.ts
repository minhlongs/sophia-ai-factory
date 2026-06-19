/**
 * Mission Reaper Cron — /api/cron/mission-reaper
 *
 * R2-9: Recovers missions that are stuck in 'pending' or 'running' status
 * because the CF Worker was killed (30-second CPU limit) before the dispatcher
 * could mark them complete or failed.
 *
 * Logic:
 *   1. Find missions with status IN ('pending','running') older than 15 minutes.
 *   2. Mark them as 'failed' with error = 'timeout_reaper'.
 *   3. Refund credits for missions where credits_used > 0 (handler may never have run).
 *   4. Return count of reaped missions.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> (standard cron auth pattern)
 * Suggested schedule: every 5 minutes — "* /5 * * * *"
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { addCredits } from '@/tree/mcu/credits-repo';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Safe } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

/** Missions stuck longer than this threshold are reaped. */
const STUCK_THRESHOLD_MINUTES = 15;

interface StuckMission {
  id: string;
  user_id: string;
  command: string;
  status: string;
  credits_used: number | null;
  created_at: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const db = await getD1Safe();
  if (!db) {
    logger.error('[cron/mission-reaper] D1 binding unavailable');
    return NextResponse.json({ error: 'D1 binding unavailable' }, { status: 503 });
  }

  let stuckMissions: StuckMission[];
  try {
    const { results } = await db
      .prepare(
        `SELECT id, user_id, command, status, credits_used, created_at
         FROM engine_missions
         WHERE status IN ('pending', 'running')
           AND created_at < strftime('%s','now') - ?`
      )
      .bind(STUCK_THRESHOLD_MINUTES * 60)
      .all();
    stuckMissions = results as unknown as StuckMission[];
  } catch (err) {
    logger.error('[cron/mission-reaper] Failed to query stuck missions', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Failed to query stuck missions' }, { status: 500 });
  }

  if (stuckMissions.length === 0) {
    return NextResponse.json({ ok: true, reaped: 0 });
  }

  let reaped = 0;
  let refunded = 0;

  for (const mission of stuckMissions) {
    const nowSec = Math.floor(Date.now() / 1000);
    try {
      const result = await db
        .prepare(
          `UPDATE engine_missions
           SET status = 'failed',
               error = 'timeout_reaper',
               updated_at = ?,
               completed_at = ?
           WHERE id = ? AND status IN ('pending', 'running')`
        )
        .bind(nowSec, nowSec, mission.id)
        .run();
      if (result.meta.changes === 0) {
        logger.info('[cron/mission-reaper] Mission was already resolved before reaper update', {
          missionId: mission.id,
          originalStatus: mission.status,
        });
        continue;
      }
      reaped++;
    } catch (err) {
      logger.error('[cron/mission-reaper] Failed to mark mission failed', {
        missionId: mission.id,
        err: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    // Refund credits only if credits were already recorded as used.
    // pending missions that never reached handler execution have credits_used = null or 0.
    const creditsToRefund = mission.credits_used ?? 0;
    if (creditsToRefund > 0) {
      try {
        const creditsAdded = await addCredits(
          mission.user_id,
          creditsToRefund,
          'reaper_refund',
          { mission_id: mission.id, original_status: mission.status },
        );
        if (!creditsAdded) {
          logger.error('[cron/mission-reaper] Failed to refund credits', {
            missionId: mission.id,
            creditsToRefund,
          });
          continue;
        }
        refunded += creditsToRefund;
      } catch (err) {
        // Non-fatal: log and continue — mission is still marked failed.
        logger.error('[cron/mission-reaper] Failed to refund credits', {
          missionId: mission.id,
          creditsToRefund,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  logger.info('[cron/mission-reaper] Done', { reaped, refunded });
  return NextResponse.json({ ok: true, reaped, credits_refunded: refunded });
}
